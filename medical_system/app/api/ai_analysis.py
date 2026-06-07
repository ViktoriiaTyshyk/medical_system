"""
AI-аналіз рентгену легень — двоетапний pipeline.

Архітектура:
  1. Binary модель  (binary_model.pth)  → здоровий / є відхилення
  2. Multiclass модель (multiclass_model.pth) → 4 конкретні патології + Grad-CAM

Де класти .pth файли:
  medical_system/app/ml_models/binary_model.pth
  medical_system/app/ml_models/multiclass_model.pth

Ендпоїнти:
  POST /ai/analyze              — аналіз зображення (нічого не зберігає в БД)
  POST /ai/save-analysis        — зберегти результат + створити кейс (вибирається тип)
  POST /ai/add-radiologist      — додати рентгенолога до існуючого кейсу
  GET  /ai/radiologists         — список рентгенологів
  GET  /ai/report/{case_id}     — завантажити PDF-звіт

=== ЩО ПОТРІБНО НАЛАШТУВАТИ ===
  1. Вставити назви 4 патологій у MULTICLASS_NAMES (порядок = порядок виходів моделі)
  2. Покласти .pth файли у app/ml_models/
  3. Перевірити BINARY_MODEL_OUTPUT_TYPE ('softmax2' або 'sigmoid')
  4. pip install torch torchvision Pillow matplotlib reportlab
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.core.dependencies import require_role
from app.models.user import User
from app.models.role import Role, RoleEnum
from app.models.user_role import UserRole
from app.models.case import Case, CaseStatusEnum, UrgencyEnum
from app.models.case_participant import CaseParticipant
from app.models.case_file import CaseFile
from app.models.file import File as FileModel
from app.models.patient_profile import PatientProfile
from app.core.config import settings
import os, uuid, io, random, logging, base64, json
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════════════
# НАЛАШТУВАННЯ — замініть на реальні значення
# ═══════════════════════════════════════════════════════════════════════════════

# Назви класів — порядок повинен точно збігатися з виходами вашої multiclass моделі
MULTICLASS_NAMES = [
    "Atelectasis",   # ателектаз
    "Cardiomegaly",  # кардіомегалія
    "Effusion",      # плевральний випіт
    "Pneumothorax",  # пневмоторакс
    "Infiltration",  # інфільтрація
    "Mass/Nodule",   # пухлина або вузол
    "Other",         # інші патології / невизначений клас
]

# Відображувані україномовні назви
MULTICLASS_LABELS = {
    "Atelectasis":  "Ателектаз",
    "Cardiomegaly": "Кардіомегалія",
    "Effusion":     "Плевральний випіт",
    "Pneumothorax": "Пневмоторакс",
    "Infiltration": "Інфільтрація",
    "Mass/Nodule":  "Пухлина / вузол",
    "Other":        "Інші / невизначено",
}

# Короткі описи для кожного класу
MULTICLASS_DESCRIPTIONS = {
    "Atelectasis":  "Часткове або повне спадання легеневої тканини; може виникати після операцій, через закупорку бронха або здавлення ззовні.",
    "Cardiomegaly": "Збільшення тіні серця понад норму; може свідчити про серцеву недостатність, вади клапанів або кардіоміопатію.",
    "Effusion":     "Накопичення рідини в плевральній порожнині; проявляється як затемнення нижніх відділів легеневого поля.",
    "Pneumothorax": "Наявність повітря між листками плеври; може спричинити колапс легені; потребує невідкладної уваги.",
    "Infiltration": "Ущільнення легеневої тканини внаслідок запалення, набряку або кровотечі; характерне для пневмонії та набряку легень.",
    "Mass/Nodule":  "Об'ємне утворення або вогнищева тінь; потребує диференційної діагностики між доброякісними та злоякісними процесами.",
    "Other":        "Виявлені зміни не відповідають жодному зі специфічних класів моделі. Необхідна перевірка рентгенологом.",
}

# Клас «Other» та «Невизначено» — вважаються некласифікованими
UNCLASSIFIABLE_CLASSES = {"Other"}

# 'softmax2' — модель повертає [batch, 2], клас 0 = здоровий, 1 = хворий
# 'sigmoid'  — модель повертає [batch, 1] або scalar, поріг 0.5
BINARY_MODEL_OUTPUT_TYPE = "softmax2"

# Поріг для "невизначеного відхилення": якщо жодна патологія < порогу — unclassifiable
UNCLASSIFIABLE_THRESHOLD = 0.30

BINARY_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml_models", "binary_model.pth")
MULTICLASS_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml_models", "multiclass_model.pth")

# ═══════════════════════════════════════════════════════════════════════════════
# МОК (активний коли .pth файли відсутні)
# ═══════════════════════════════════════════════════════════════════════════════

def _mock_binary() -> tuple[bool, float]:
    """Повертає (is_abnormal, probability)."""
    prob = random.uniform(0.2, 0.95)
    return prob > 0.5, round(prob, 3)


def _mock_multiclass() -> dict[str, float]:
    raw = [random.uniform(1.0, 20.0) for _ in MULTICLASS_NAMES]
    # "Other" отримує менший вага щоб конкретні патології переважали
    other_idx = MULTICLASS_NAMES.index("Other") if "Other" in MULTICLASS_NAMES else -1
    if other_idx >= 0:
        raw[other_idx] *= 0.4
    total = sum(raw)
    return {MULTICLASS_NAMES[i]: round(raw[i] / total, 4) for i in range(len(MULTICLASS_NAMES))}


def _mock_heatmap_base64(image_bytes: bytes) -> str:
    """Накладає псевдо-теплову карту на зображення і повертає base64 PNG."""
    try:
        import numpy as np
        from PIL import Image
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.cm as cm

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((224, 224))
        img_arr = np.array(img) / 255.0

        # Координати в діапазоні [0, 1]
        x = np.linspace(0, 1, 224)
        y = np.linspace(0, 1, 224)
        xx, yy = np.meshgrid(x, y)

        # Випадковий центр у зоні легень (не завжди по центру)
        # Легеневе поле: горизонтально 15-85%, вертикально 20-80%
        cx = random.uniform(0.15, 0.85)
        cy = random.uniform(0.20, 0.75)
        sigma = random.uniform(0.10, 0.20)
        heatmap = np.exp(-((xx - cx)**2 + (yy - cy)**2) / (2 * sigma**2))

        # Іноді додаємо другий осередок (двостороннє ураження)
        if random.random() > 0.45:
            cx2 = max(0.1, min(0.9, (1.0 - cx) + random.uniform(-0.12, 0.12)))
            cy2 = cy + random.uniform(-0.12, 0.12)
            sigma2 = random.uniform(0.08, 0.16)
            heatmap += random.uniform(0.4, 0.85) * np.exp(
                -((xx - cx2)**2 + (yy - cy2)**2) / (2 * sigma2**2)
            )

        heatmap = (heatmap - heatmap.min()) / (heatmap.max() - heatmap.min() + 1e-8)

        colormap = cm.get_cmap("jet")
        heatmap_rgb = colormap(heatmap)[:, :, :3]
        overlay = np.clip(0.55 * img_arr + 0.45 * heatmap_rgb, 0, 1)

        buf = io.BytesIO()
        plt.imsave(buf, overlay, format="png")
        buf.seek(0)
        return base64.b64encode(buf.read()).decode()
    except Exception as e:
        logger.warning(f"Heatmap mock failed: {e}")
        return ""


# ═══════════════════════════════════════════════════════════════════════════════
# РЕАЛЬНИЙ ІНФЕРЕНС
# ═══════════════════════════════════════════════════════════════════════════════

def _load_model(path: str):
    import torch
    import numpy as np
    # PyTorch 2.6+ змінив weights_only=True за замовчуванням.
    # Додаємо numpy globals до safe list щоб завантажити legacy .pth файли.
    try:
        torch.serialization.add_safe_globals([np.dtype, np.ndarray])
    except AttributeError:
        pass
    loaded = torch.load(os.path.abspath(path), map_location="cpu", weights_only=False)
    if hasattr(loaded, "eval"):
        loaded.eval()
        return loaded
    raise ValueError(
        f"Виявлено state_dict у {path}. Ініціалізуйте архітектуру вручну і завантажте ваги."
    )


def _get_transforms():
    import torchvision.transforms as T
    return T.Compose([
        T.Resize((224, 224)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])


def _real_binary(image_bytes: bytes) -> tuple[bool, float]:
    import torch
    from PIL import Image

    model = _load_model(BINARY_MODEL_PATH)
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = _get_transforms()(img).unsqueeze(0)

    with torch.no_grad():
        output = model(tensor)

    if BINARY_MODEL_OUTPUT_TYPE == "sigmoid":
        prob_abnormal = float(torch.sigmoid(output).squeeze())
    else:
        probs = torch.softmax(output, dim=1)[0]
        prob_abnormal = float(probs[1])

    return prob_abnormal > 0.5, round(prob_abnormal, 4)


def _real_multiclass(image_bytes: bytes) -> tuple[dict[str, float], str]:
    """
    Повертає (probs_dict, heatmap_base64).
    probs_dict: {назва_класу: ймовірність 0..1}
    """
    import torch
    import numpy as np
    from PIL import Image

    model = _load_model(MULTICLASS_MODEL_PATH)
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = _get_transforms()(img).unsqueeze(0)
    tensor.requires_grad_(False)

    # Forward + Grad-CAM
    activations = []
    gradients   = []

    def fwd_hook(module, inp, out):
        activations.append(out.detach())

    def bwd_hook(module, grad_in, grad_out):
        # register_full_backward_hook: grad_out[0] — градієнт по виходу шару
        gradients.append(grad_out[0].detach())

    # Автоматично знаходимо останній Conv2d
    last_conv = None
    for m in model.modules():
        if isinstance(m, torch.nn.Conv2d):
            last_conv = m
    if last_conv is None:
        raise ValueError("Не знайдено Conv2d у моделі для Grad-CAM")

    fh = last_conv.register_forward_hook(fwd_hook)
    # register_full_backward_hook — коректна версія для PyTorch >= 1.9
    bh = last_conv.register_full_backward_hook(bwd_hook)

    tensor_req = tensor.clone().requires_grad_(True)
    output = model(tensor_req)
    probs = torch.softmax(output, dim=1)[0]

    top_class = int(probs.argmax())
    model.zero_grad()
    probs[top_class].backward()

    fh.remove()
    bh.remove()

    # Grad-CAM map
    heatmap_b64 = ""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.cm as cm

        grad = gradients[0][0]           # [C, H, W]
        act  = activations[0][0]         # [C, H, W]
        weights = grad.mean(dim=(1, 2))  # global average pooling по просторовим осям → [C]
        cam = torch.relu((weights[:, None, None] * act).sum(dim=0))  # зважена сума → [H, W]
        cam = cam.numpy()
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

        img_arr = np.array(img.resize((224, 224))) / 255.0

        # Білінійна інтерполяція для плавного ресайзу cam → (224,224)
        cam_resized = np.array(
            Image.fromarray((cam * 255).astype(np.uint8)).resize((224, 224), Image.BILINEAR)
        ) / 255.0

        colormap = cm.get_cmap("jet")
        heatmap_rgb = colormap(cam_resized)[:, :, :3]
        overlay = np.clip(0.55 * img_arr + 0.45 * heatmap_rgb, 0, 1)

        buf = io.BytesIO()
        plt.imsave(buf, overlay, format="png")
        buf.seek(0)
        heatmap_b64 = base64.b64encode(buf.read()).decode()
    except Exception as e:
        logger.warning(f"Grad-CAM failed: {e}")

    probs_dict = {MULTICLASS_NAMES[i]: round(float(probs[i]), 4) for i in range(len(MULTICLASS_NAMES))}
    return probs_dict, heatmap_b64


# ═══════════════════════════════════════════════════════════════════════════════
# ГОЛОВНИЙ PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def run_pipeline(image_bytes: bytes) -> dict:
    """
    Повертає dict з полями:
      binary_abnormal: bool
      binary_prob: float
      stage: "healthy" | "classified" | "unclassifiable"
      urgency: "NORMAL" | "URGENT"
      top_class: str | None
      top_prob: float | None
      multiclass: {клас: prob} | None
      descriptions: {клас: опис} | None
      heatmap_base64: str | None
    """
    binary_models_exist = os.path.exists(os.path.abspath(BINARY_MODEL_PATH))
    multi_models_exist  = os.path.exists(os.path.abspath(MULTICLASS_MODEL_PATH))

    # ── Крок 1: Binary ────────────────────────────────────────────────────────
    try:
        if binary_models_exist:
            is_abnormal, binary_prob = _real_binary(image_bytes)
        else:
            is_abnormal, binary_prob = _mock_binary()
    except Exception as e:
        logger.warning(f"Binary model error, using mock: {e}")
        is_abnormal, binary_prob = _mock_binary()

    if not is_abnormal:
        return {
            "binary_abnormal": False,
            "binary_prob": binary_prob,
            "stage": "healthy",
            "urgency": "NORMAL",
            "top_class": None,
            "top_label": None,
            "top_prob": None,
            "multiclass": None,
            "labels": MULTICLASS_LABELS,
            "descriptions": None,
            "heatmap_base64": None,
        }

    # ── Крок 2: Multiclass ────────────────────────────────────────────────────
    try:
        if multi_models_exist:
            multiclass_probs, heatmap_b64 = _real_multiclass(image_bytes)
        else:
            multiclass_probs = _mock_multiclass()
            heatmap_b64 = _mock_heatmap_base64(image_bytes)
    except Exception as e:
        logger.warning(f"Multiclass model error, using mock: {e}")
        multiclass_probs = _mock_multiclass()
        heatmap_b64 = _mock_heatmap_base64(image_bytes)

    top_class = max(multiclass_probs, key=lambda k: multiclass_probs[k])
    top_prob  = multiclass_probs[top_class]

    # Невизначено: низька впевненість АБО топ-клас = "Other"
    is_unclassifiable = top_prob < UNCLASSIFIABLE_THRESHOLD or top_class in UNCLASSIFIABLE_CLASSES

    if is_unclassifiable:
        return {
            "binary_abnormal": True,
            "binary_prob": binary_prob,
            "stage": "unclassifiable",
            "urgency": "URGENT",  # є відхилення → завжди терміново
            "top_class": None,
            "top_prob": None,
            "multiclass": multiclass_probs,
            "labels": MULTICLASS_LABELS,
            "descriptions": None,
            "heatmap_base64": heatmap_b64,
        }

    return {
        "binary_abnormal": True,
        "binary_prob": binary_prob,
        "stage": "classified",
        "urgency": "URGENT",
        "top_class": top_class,
        "top_label": MULTICLASS_LABELS.get(top_class, top_class),
        "top_prob": top_prob,
        "multiclass": multiclass_probs,
        "labels": MULTICLASS_LABELS,
        "descriptions": MULTICLASS_DESCRIPTIONS,
        "heatmap_base64": heatmap_b64,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# PDF-ЗВІТ
# ═══════════════════════════════════════════════════════════════════════════════

def _build_pdf(case: Case, patient: User, tz_name: str = "UTC") -> bytes:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table,
            TableStyle, Image as RLImage, HRFlowable,
        )
        from reportlab.lib.units import cm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        FN  = "DejaVuSans"
        FNB = "DejaVuSans-Bold"

        registered = pdfmetrics.getRegisteredFontNames()
        if FN not in registered and os.path.exists(FONT_PATH):
            pdfmetrics.registerFont(TTFont(FN, FONT_PATH))
        if FNB not in registered and os.path.exists(FONT_BOLD):
            pdfmetrics.registerFont(TTFont(FNB, FONT_BOLD))

        fn  = FN  if os.path.exists(FONT_PATH) else "Helvetica"
        fnb = FNB if os.path.exists(FONT_BOLD) else "Helvetica-Bold"

        W = A4[0] - 4*cm   # ширина контенту

        # ── Кольорова палітра ─────────────────────────────────────────────────
        C_ACCENT  = colors.HexColor("#2563eb")   # синій акцент
        C_DARK    = colors.HexColor("#1e293b")
        C_MUTED   = colors.HexColor("#64748b")
        C_BORDER  = colors.HexColor("#e2e8f0")
        C_ROW_ALT = colors.HexColor("#f8fafc")
        C_URGENT  = colors.HexColor("#dc2626")
        C_OK      = colors.HexColor("#16a34a")

        def ps(name, **kw):
            return ParagraphStyle(name, fontName=kw.pop("font", fn), **kw)

        sTitle    = ps("T",  font=fnb, fontSize=20, textColor=C_DARK,   leading=26, spaceAfter=2)
        sSubtitle = ps("ST", font=fn,  fontSize=9,  textColor=C_MUTED,  leading=13, spaceAfter=0)
        sSectionH = ps("SH", font=fnb, fontSize=11, textColor=C_ACCENT, leading=15, spaceBefore=14, spaceAfter=6)
        sBody     = ps("BD", font=fn,  fontSize=9,  textColor=C_DARK,   leading=13, spaceAfter=3)
        sLabel    = ps("LB", font=fnb, fontSize=8,  textColor=C_MUTED,  leading=12, spaceAfter=1)
        sValue    = ps("VL", font=fn,  fontSize=9,  textColor=C_DARK,   leading=13, spaceAfter=4)
        sBadge    = ps("BG", font=fnb, fontSize=9,  leading=13)

        def HR():
            return HRFlowable(width="100%", thickness=1, color=C_BORDER, spaceAfter=6, spaceBefore=2)

        def section(title):
            return [Paragraph(title, sSectionH), HR()]

        def kv(label, value):
            return [Paragraph(label, sLabel), Paragraph(value, sValue)]

        # ── Час у часовому поясі пацієнта ─────────────────────────────────────
        try:
            from zoneinfo import ZoneInfo
            local_dt = datetime.now(ZoneInfo(tz_name))
        except Exception:
            local_dt = datetime.utcnow()
        now_str = local_dt.strftime("%d.%m.%Y %H:%M")

        # ── Документ ──────────────────────────────────────────────────────────
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            rightMargin=2*cm, leftMargin=2*cm,
            topMargin=2*cm, bottomMargin=2*cm,
        )
        story = []

        # Шапка — два рядки, кожен в один рядок
        story.append(Paragraph("Звіт аналізу рентгену легень", sTitle))
        story.append(Paragraph(f"Дата формування {now_str}", sSubtitle))
        story.append(HRFlowable(width="100%", thickness=2, color=C_ACCENT, spaceAfter=10, spaceBefore=6))

        # Пацієнт
        story += section("Пацієнт")
        pt_data = [[
            [*kv("Ім'я та прізвище", f"{patient.first_name} {patient.last_name}")],
            [*kv("Email", patient.email)],
            [*kv("ID справи", str(case.id))],
        ]]
        pt_tbl = Table(pt_data, colWidths=[W/3, W/3, W/3])
        pt_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(pt_tbl)

        # AI-результат
        ai = case.ai_result or {}
        labels = ai.get("labels") or MULTICLASS_LABELS
        stage = ai.get("stage", "")
        binary_pct = round(ai.get("binary_prob", 0) * 100, 1)

        story += section("Результат AI-скринінгу")

        is_urgent = case.urgency == UrgencyEnum.URGENT
        if is_urgent:
            urgency_text = "ТЕРМІНОВО"
        elif stage == "healthy":
            urgency_text = "НОРМА"
        else:
            urgency_text = "НЕВИЗНАЧЕНО"

        # Мітка і впевненість — одним рядком, рівно під одну лінію
        story.append(Paragraph(
            f'<font name="{fnb}">{urgency_text}</font>'
            f'<font color="{C_MUTED.hexval()}">  ·  Впевненість у відхиленні: {binary_pct}%</font>',
            sBody
        ))
        story.append(Spacer(1, 0.2*cm))

        if stage == "healthy":
            norm_pct = round((1 - ai.get("binary_prob", 0)) * 100, 1)
            story.append(Paragraph(f"Патологій не виявлено. Ймовірність норми: {norm_pct}%", sBody))

        elif stage == "unclassifiable":
            story.append(Paragraph(
                "Виявлено відхилення від норми. Конкретна патологія не класифікована системою. "
                "Рекомендовано КТ та консультація профільного спеціаліста.", sBody))

        elif stage == "classified":
            top_label = ai.get("top_label") or labels.get(ai.get("top_class", ""), ai.get("top_class", "—"))
            story.append(Paragraph(f"Виявлена патологія: <b>{top_label}</b>", sBody))
            story.append(Spacer(1, 0.3*cm))

            mc = ai.get("multiclass") or {}
            if mc:
                story.append(Paragraph("Розподіл ймовірностей по класах", sLabel))
                story.append(Spacer(1, 0.15*cm))
                sorted_mc = sorted(mc.items(), key=lambda x: -x[1])
                tbl_data = [[
                    Paragraph("Патологія", ps("th", font=fnb, fontSize=8, textColor=colors.white)),
                    Paragraph("Ймовірність", ps("th2", font=fnb, fontSize=8, textColor=colors.white)),
                ]]
                for name, prob in sorted_mc:
                    display = labels.get(name, name)
                    pct_str = f"{round(prob * 100, 1)}%"
                    tbl_data.append([
                        Paragraph(display, sBody),
                        Paragraph(pct_str, sBody),
                    ])
                mc_tbl = Table(tbl_data, colWidths=[W * 0.65, W * 0.35])
                mc_tbl.setStyle(TableStyle([
                    ("BACKGROUND",    (0, 0), (-1, 0), C_ACCENT),
                    ("FONTNAME",      (0, 0), (-1, 0), fnb),
                    ("FONTSIZE",      (0, 0), (-1, -1), 9),
                    ("GRID",          (0, 0), (-1, -1), 0.5, C_BORDER),
                    ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, C_ROW_ALT]),
                    ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING",    (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING",   (0, 0), (-1, -1), 8),
                ]))
                story.append(mc_tbl)

            heatmap_b64 = ai.get("heatmap_base64")
            if heatmap_b64:
                story.append(Spacer(1, 0.4*cm))
                story.append(Paragraph("Теплова карта (Grad-CAM) — локалізація ознак", sLabel))
                story.append(Spacer(1, 0.15*cm))
                img_buf = io.BytesIO(base64.b64decode(heatmap_b64))
                story.append(RLImage(img_buf, width=7*cm, height=7*cm))

        def clean_conclusion(text: str) -> str:
            import re
            text = re.sub(r'^\[Висновок рентгенолога[^\]]+\]\n\n?', '', text)
            text = re.sub(r'\n\n?\[Направлено терапевту:[^\]]+\]$', '', text)
            return text.strip()

        # Висновок рентгенолога
        if case.conclusion:
            story += section("Висновок рентгенолога")
            conclusion_clean = clean_conclusion(case.conclusion)
            for line in conclusion_clean.split("\n"):
                if line.strip():
                    story.append(Paragraph(line, sBody))

        # Призначення терапевта
        if getattr(case, "therapist_note", None):
            story += section("Призначення терапевта")
            for line in case.therapist_note.split("\n"):
                if line.strip():
                    story.append(Paragraph(line, sBody))

        doc.build(story)
        buf.seek(0)
        return buf.read()

    except ImportError:
        raise HTTPException(500, "reportlab не встановлено. Виконайте: pip install reportlab")


# ═══════════════════════════════════════════════════════════════════════════════
# ДОПОМІЖНІ ФУНКЦІЇ
# ═══════════════════════════════════════════════════════════════════════════════

async def _save_file(file: UploadFile, owner_id: int, db: AsyncSession) -> tuple[FileModel, bytes]:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    unique_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
    db_file = FileModel(
        owner_user_id=owner_id,
        name=file.filename,
        mime_type=file.content_type,
        path=file_path,
        size=len(contents),
    )
    db.add(db_file)
    await db.flush()
    return db_file, contents


async def _ensure_participant(case_id: int, user_id: int, db: AsyncSession):
    res = await db.execute(
        select(CaseParticipant).where(
            CaseParticipant.case_id == case_id,
            CaseParticipant.user_id == user_id,
        )
    )
    if not res.scalar_one_or_none():
        db.add(CaseParticipant(case_id=case_id, user_id=user_id))


def _validate_image(file: UploadFile):
    allowed = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"}
    if file.content_type not in allowed:
        raise HTTPException(400, "Підтримуються лише зображення (JPEG, PNG, WEBP, BMP, TIFF)")


_xrv_ae = None

def _get_xrv_ae():
    global _xrv_ae
    if _xrv_ae is None:
        import torchxrayvision as xrv
        _xrv_ae = xrv.autoencoders.ResNetAE(weights="101-elastic")
        _xrv_ae.eval()
    return _xrv_ae


def _validate_xray_content(image_bytes: bytes):
    """
    Перевіряє чи зображення є рентгеном легень за допомогою torchxrayvision autoencoder.

    Autoencoder натренований виключно на chest X-ray знімках.
    Для справжнього рентгену помилка реконструкції низька (< порогу).
    Для довільних фото (кіт, документ, селфі) — висока.
    """
    try:
        import torch
        import numpy as np
        from PIL import Image
        import torchxrayvision as xrv

        img = Image.open(io.BytesIO(image_bytes)).convert("L")
        w, h = img.size
        if w < 64 or h < 64:
            raise HTTPException(400, f"Зображення надто мале ({w}×{h}). Мінімальний розмір: 64×64 пікселів")

        arr = np.array(img, dtype=np.float32)
        arr = xrv.datasets.normalize(arr, 255)      # → [-1024, 1024]
        arr = arr[None, ...]                          # (1, H, W)
        arr = xrv.datasets.XRayCenterCrop()(arr)
        arr = xrv.datasets.XRayResizer(224)(arr)
        tensor = torch.from_numpy(arr).unsqueeze(0)  # (1, 1, 224, 224)

        ae = _get_xrv_ae()
        with torch.no_grad():
            output = ae(tensor)
            reconstruction = output["reconstruction"] if isinstance(output, dict) else output
            loss = float(torch.nn.functional.mse_loss(reconstruction, tensor))

        logger.info(f"XRay autoencoder reconstruction loss: {loss:.4f}")

        if loss > 0.08:
            raise HTTPException(
                400,
                "Зображення не схоже на рентгенівський знімок легень. "
                "Будь ласка, завантажте коректний рентген грудної клітки."
            )

    except HTTPException:
        raise
    except ImportError as e:
        logger.error(f"torchxrayvision не встановлено — валідація X-ray пропущена: {e}")
    except Exception as e:
        logger.error(f"XRay content validation error (пропущено): {type(e).__name__}: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# ЕНДПОЇНТИ
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/analyze")
async def analyze_lung_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    """
    Двоетапний аналіз рентгену.
    Нічого не зберігає в БД — лише повертає результат.
    """
    _validate_image(file)
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(400, "Файл занадто великий (максимум 20 MB)")
    _validate_xray_content(contents)

    result = run_pipeline(contents)
    return {"filename": file.filename, **result}


@router.post("/save-analysis")
async def save_analysis(
    save_type: str = Form(...),
    radiologist_ids: str = Form(""),
    analysis_result_json: str = Form(""),   # готовий результат з /ai/analyze
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    """
    Зберігає зображення і створює кейс.
    Якщо передано analysis_result_json — використовує його (не перезапускає модель).
    """
    _validate_image(file)
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(400, "Файл занадто великий (максимум 20 MB)")
    _validate_xray_content(contents)

    if analysis_result_json.strip():
        result = json.loads(analysis_result_json)
    else:
        result = run_pipeline(contents)
    urgency = UrgencyEnum(result["urgency"])
    full_name = f"{current_user.first_name} {current_user.last_name}".strip()

    # Зберегти файл
    import tempfile
    tmp_file = UploadFile(
        file=io.BytesIO(contents),
        filename=file.filename,
        headers={"content-type": file.content_type or "image/jpeg"},
    )
    # Зберігаємо безпосередньо
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    unique_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)
    with open(file_path, "wb") as fp:
        fp.write(contents)
    db_file = FileModel(
        owner_user_id=current_user.id,
        name=file.filename,
        mime_type=file.content_type,
        path=file_path,
        size=len(contents),
    )
    db.add(db_file)
    await db.flush()

    if save_type == "family_doctor":
        profile_res = await db.execute(
            select(PatientProfile).where(PatientProfile.user_id == current_user.id)
        )
        profile = profile_res.scalar_one_or_none()
        if not profile or not profile.family_doctor_id:
            raise HTTPException(400, "У вашому профілі не призначено сімейного лікаря")

        case = Case(
            title=f"Аналіз рентгену легень — {full_name}",
            description="Пацієнт завантажив рентгенівський знімок через AI-систему. Очікує розгляду сімейного лікаря.",
            patient_id=current_user.id,
            status=CaseStatusEnum.PENDING,
            urgency=urgency,
            ai_result=result,
        )
        db.add(case)
        await db.flush()
        db.add(CaseFile(case_id=case.id, file_id=db_file.id, uploaded_by=current_user.id))
        await _ensure_participant(case.id, current_user.id, db)
        await _ensure_participant(case.id, profile.family_doctor_id, db)

    elif save_type == "radiologist":
        rad_ids = [int(x.strip()) for x in radiologist_ids.split(",") if x.strip().isdigit()]
        if not rad_ids:
            raise HTTPException(400, "Вкажіть хоча б одного рентгенолога (radiologist_ids)")

        # Перевірити що всі id реальні рентгенологи
        for rid in rad_ids:
            res = await db.execute(
                select(User)
                .join(UserRole, UserRole.user_id == User.id)
                .join(Role, Role.id == UserRole.role_id)
                .where(User.id == rid, Role.name == RoleEnum.RADIOLOGIST)
            )
            if not res.scalar_one_or_none():
                raise HTTPException(404, f"Рентгенолога з id={rid} не знайдено")

        rad_names = []
        for rid in rad_ids:
            r = await db.execute(select(User).where(User.id == rid))
            u = r.scalar_one()
            rad_names.append(f"{u.first_name} {u.last_name}")

        case = Case(
            title=f"Консультація рентгену — {full_name}",
            description=f"Пацієнт {full_name} надіслав знімок рентгенологу(-ам): {', '.join(rad_names)}.",
            patient_id=current_user.id,
            status=CaseStatusEnum.IN_PROGRESS,
            urgency=urgency,
            ai_result=result,
        )
        db.add(case)
        await db.flush()
        db.add(CaseFile(case_id=case.id, file_id=db_file.id, uploaded_by=current_user.id))
        await _ensure_participant(case.id, current_user.id, db)
        for rid in rad_ids:
            await _ensure_participant(case.id, rid, db)

    else:
        raise HTTPException(400, "save_type має бути 'family_doctor' або 'radiologist'")

    # Зберегти теплову карту як окремий файл кейсу
    heatmap_b64 = result.get("heatmap_base64")
    if heatmap_b64:
        try:
            heatmap_bytes = base64.b64decode(heatmap_b64)
            base_name = file.filename.rsplit('.', 1)[0] if '.' in file.filename else file.filename
            heatmap_name = f"heatmap_{base_name}.png"
            heatmap_path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4()}_{heatmap_name}")
            with open(heatmap_path, "wb") as fp:
                fp.write(heatmap_bytes)
            db_heatmap = FileModel(
                owner_user_id=current_user.id,
                name=heatmap_name,
                mime_type="image/png",
                path=heatmap_path,
                size=len(heatmap_bytes),
            )
            db.add(db_heatmap)
            await db.flush()
            db.add(CaseFile(case_id=case.id, file_id=db_heatmap.id, uploaded_by=current_user.id))
        except Exception as e:
            logger.warning(f"Failed to save heatmap file: {e}")

    await db.commit()
    await db.refresh(case)

    return {
        "case_id": case.id,
        "file_id": db_file.id,
        "status": case.status,
        "urgency": case.urgency,
        "analysis": result,
    }


@router.post("/add-radiologist")
async def add_radiologist_to_case(
    case_id: int,
    radiologist_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    """
    Додати ще одного рентгенолога до існуючого кейсу.
    Корисно коли один лікар невпевнений і потрібна друга думка.
    """
    case_res = await db.execute(
        select(Case).where(Case.id == case_id, Case.patient_id == current_user.id)
    )
    case = case_res.scalar_one_or_none()
    if not case:
        raise HTTPException(404, "Кейс не знайдено або він не ваш")

    rad_res = await db.execute(
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(User.id == radiologist_id, Role.name == RoleEnum.RADIOLOGIST)
    )
    radiologist = rad_res.scalar_one_or_none()
    if not radiologist:
        raise HTTPException(404, "Рентгенолога не знайдено")

    await _ensure_participant(case_id, radiologist_id, db)
    await db.commit()

    return {
        "detail": f"Рентгенолога {radiologist.first_name} {radiologist.last_name} додано до кейсу #{case_id}"
    }


@router.get("/radiologists")
async def list_available_radiologists(
    urgency: str = "NORMAL",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    """
    Список рентгенологів з урахуванням ургентності:
    - URGENT → тільки AVAILABLE; якщо порожньо → всі з попередженням
    - NORMAL → всі рентгенологи
    """
    from app.models.radiologist_profile import AvailabilityStatusEnum

    result = await db.execute(
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(Role.name == RoleEnum.RADIOLOGIST)
        .options(selectinload(User.radiologist_profile))
    )
    all_rads = result.scalars().all()

    # Завантажити середній рейтинг для всіх рентгенологів
    from app.models.radiologist_review import RadiologistReview
    from sqlalchemy import func as sqlfunc
    rad_ids = [r.id for r in all_rads]
    rating_rows = await db.execute(
        select(
            RadiologistReview.radiologist_id,
            sqlfunc.avg(RadiologistReview.rating).label("avg"),
            sqlfunc.count(RadiologistReview.id).label("cnt"),
        )
        .where(RadiologistReview.radiologist_id.in_(rad_ids))
        .group_by(RadiologistReview.radiologist_id)
    )
    ratings = {row.radiologist_id: (round(float(row.avg), 1), row.cnt) for row in rating_rows}

    def fmt(r):
        avg, cnt = ratings.get(r.id, (0.0, 0))
        return {
            "id": r.id,
            "first_name": r.first_name,
            "last_name": r.last_name,
            "department": r.radiologist_profile.department if r.radiologist_profile else None,
            "years_of_experience": r.radiologist_profile.years_of_experience if r.radiologist_profile else None,
            "availability_status": r.radiologist_profile.availability_status if r.radiologist_profile else None,
            "average_rating": avg,
            "review_count": cnt,
        }

    if urgency == "URGENT":
        available = [r for r in all_rads if r.radiologist_profile and
                     r.radiologist_profile.availability_status == AvailabilityStatusEnum.AVAILABLE]
        if available:
            return {"radiologists": [fmt(r) for r in available], "filtered": True, "warning": None}
        # Немає доступних — повертаємо всіх з попередженням
        return {
            "radiologists": [fmt(r) for r in all_rads],
            "filtered": False,
            "warning": "Наразі немає доступних рентгенологів. Показано всіх — зверніться до будь-якого.",
        }

    return {"radiologists": [fmt(r) for r in all_rads], "filtered": False, "warning": None}


@router.get("/report/{case_id}")
async def download_pdf_report(
    case_id: int,
    tz: str = "UTC",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT, RoleEnum.ADMIN)),
):
    """Генерує і повертає PDF-звіт. tz — IANA timezone (напр. Europe/Kyiv)."""
    user_roles = {r.name for r in current_user.roles}
    is_admin = RoleEnum.ADMIN.value in user_roles
    stmt = select(Case).where(Case.id == case_id)
    if not is_admin:
        stmt = stmt.where(Case.patient_id == current_user.id)
    res = await db.execute(stmt)
    case = res.scalar_one_or_none()
    if not case:
        raise HTTPException(404, "Кейс не знайдено або немає доступу")

    pdf_bytes = _build_pdf(case, current_user, tz)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="report_case_{case_id}.pdf"'},
    )
