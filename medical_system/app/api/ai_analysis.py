"""
AI-аналіз рентгену легень.

Ендпоїнти:
  POST /ai/analyze              — аналіз зображення (мок), нічого не зберігає в БД
  POST /ai/propose-case         — зберігає зображення + PENDING кейс для сімейного лікаря
  GET  /ai/radiologists         — список доступних рентгенологів для вибору
  POST /ai/consult-radiologist  — кейс IN_PROGRESS із вибраним рентгенологом

Для підключення реальної моделі:
  1. Покласти файл у app/ml_models/lung_model.pth
  2. Розкоментувати блок REAL MODEL нижче і закоментувати MOCK
  3. Перевірити порядок CLASS_NAMES
  4. pip install torch torchvision Pillow
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.core.dependencies import require_role
from app.models.user import User
from app.models.role import Role, RoleEnum
from app.models.user_role import UserRole
from app.models.case import Case, CaseStatusEnum
from app.models.case_participant import CaseParticipant
from app.models.case_file import CaseFile
from app.models.file import File as FileModel
from app.models.patient_profile import PatientProfile
from app.core.config import settings
import os, uuid, io, random, logging

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Назви класів ────────────────────────────────────────────────────────────
CLASS_NAMES = [
    "Норма",
    "Пневмонія",
    "COVID-19",
    "Туберкульоз",
    "Рак легень",
    "Плевральний випіт",
]

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml_models", "lung_model.pth")


# ── Інференс (МОК поки модель відсутня) ─────────────────────────────────────

def _mock_predict() -> dict[str, float]:
    """
    Повертає псевдовипадкові відсотки, що в сумі дають 100.
    Замінити на _real_predict() коли модель буде готова.
    """
    raw = [random.uniform(0.5, 10.0) for _ in range(len(CLASS_NAMES))]
    # Перший клас («Норма») отримує більший weight щоб результати виглядали реалістично
    raw[0] *= random.uniform(3, 8)
    total = sum(raw)
    return {CLASS_NAMES[i]: round(raw[i] / total * 100, 2) for i in range(len(CLASS_NAMES))}


def _real_predict(image_bytes: bytes) -> dict[str, float]:
    """
    Реальний інференс — розкоментувати коли модель готова.
    """
    import torch
    import torchvision.transforms as T
    from PIL import Image

    abs_path = os.path.abspath(MODEL_PATH)
    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"Файл моделі не знайдено: {abs_path}")

    loaded = torch.load(abs_path, map_location="cpu")
    if hasattr(loaded, "eval"):
        model = loaded
    else:
        raise ValueError(
            "Виявлено state_dict. Ініціалізуйте архітектуру вручну в ai_analysis.py"
        )
    model.eval()

    transform = T.Compose([
        T.Resize((224, 224)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = transform(img).unsqueeze(0)

    import torch
    with torch.no_grad():
        outputs = model(tensor)
        probs = torch.softmax(outputs, dim=1)[0]

    return {CLASS_NAMES[i]: round(float(probs[i]) * 100, 2) for i in range(len(CLASS_NAMES))}


def _predict(image_bytes: bytes) -> dict[str, float]:
    """Точка входу — перемикач між моком і реальною моделлю."""
    if os.path.exists(os.path.abspath(MODEL_PATH)):
        try:
            return _real_predict(image_bytes)
        except Exception as e:
            logger.warning(f"Реальна модель недоступна, використовую мок: {e}")
    return _mock_predict()


# ── Допоміжні функції ────────────────────────────────────────────────────────

async def _save_file(file: UploadFile, owner_id: int, db: AsyncSession) -> tuple[FileModel, bytes]:
    """Зберігає UploadFile на диск і в таблицю files. Повертає (db_file, contents)."""
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


async def _attach_file_to_case(case_id: int, file_id: int, uploader_id: int, db: AsyncSession):
    cf = CaseFile(case_id=case_id, file_id=file_id, uploaded_by=uploader_id)
    db.add(cf)


async def _add_participant(case_id: int, user_id: int, db: AsyncSession):
    db.add(CaseParticipant(case_id=case_id, user_id=user_id))


# ── Ендпоїнти ────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_lung_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    """
    Аналізує рентген легень. Нічого не зберігає в БД.
    Повертає відсотки по класах хвороб.
    """
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"}
    if file.content_type not in allowed_types:
        raise HTTPException(400, detail="Підтримуються лише зображення (JPEG, PNG, WEBP, BMP, TIFF)")

    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(400, detail="Файл занадто великий (максимум 20 MB)")

    results = _predict(contents)
    return {"results": results, "filename": file.filename}


@router.post("/propose-case")
async def propose_case(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    """
    Зберігає зображення і створює PENDING кейс для сімейного лікаря пацієнта.
    """
    result = await db.execute(
        select(PatientProfile).where(PatientProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile or not profile.family_doctor_id:
        raise HTTPException(400, detail="У вашому профілі не призначено сімейного лікаря")

    family_doctor_id = profile.family_doctor_id

    db_file, _ = await _save_file(file, current_user.id, db)

    full_name = f"{current_user.first_name} {current_user.last_name}".strip()
    case = Case(
        title=f"Аналіз рентгену легень — {full_name}",
        description=(
            "Пацієнт завантажив рентгенівський знімок легень через систему AI-аналізу. "
            "Кейс очікує розгляду сімейного лікаря."
        ),
        patient_id=current_user.id,
        status=CaseStatusEnum.PENDING,
    )
    db.add(case)
    await db.flush()

    await _attach_file_to_case(case.id, db_file.id, current_user.id, db)
    await _add_participant(case.id, current_user.id, db)
    await _add_participant(case.id, family_doctor_id, db)

    await db.commit()
    await db.refresh(case)

    return {
        "case_id": case.id,
        "file_id": db_file.id,
        "status": case.status,
        "message": "Кейс успішно запропоновано вашому сімейному лікарю",
    }


@router.get("/radiologists")
async def list_available_radiologists(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    """
    Повертає список усіх активних рентгенологів для вибору пацієнтом.
    """
    result = await db.execute(
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(Role.name == RoleEnum.RADIOLOGIST)
        .options(selectinload(User.radiologist_profile))
    )
    radiologists = result.scalars().all()

    return [
        {
            "id": r.id,
            "first_name": r.first_name,
            "last_name": r.last_name,
            "department": r.radiologist_profile.department if r.radiologist_profile else None,
            "years_of_experience": r.radiologist_profile.years_of_experience if r.radiologist_profile else None,
            "availability_status": r.radiologist_profile.availability_status if r.radiologist_profile else None,
        }
        for r in radiologists
    ]


@router.post("/consult-radiologist")
async def consult_radiologist(
    radiologist_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    """
    Пацієнт надсилає рентген конкретному рентгенологу для консультації.
    Створює кейс зі статусом IN_PROGRESS — рентгенолог одразу бачить його у
    своєму списку і може починати роботу без зайвих підтверджень.
    Чат між пацієнтом і рентгенологом доступний одразу.
    """
    # Перевірити що рентгенолог існує і має потрібну роль
    result = await db.execute(
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(User.id == radiologist_id, Role.name == RoleEnum.RADIOLOGIST)
    )
    radiologist = result.scalar_one_or_none()
    if not radiologist:
        raise HTTPException(404, detail="Рентгенолога не знайдено")

    db_file, _ = await _save_file(file, current_user.id, db)

    full_name = f"{current_user.first_name} {current_user.last_name}".strip()
    rad_name = f"{radiologist.first_name} {radiologist.last_name}".strip()

    case = Case(
        title=f"Консультація рентгену — {full_name}",
        description=(
            f"Пацієнт {full_name} надіслав рентгенівський знімок легень "
            f"рентгенологу {rad_name} для консультації через AI-систему."
        ),
        patient_id=current_user.id,
        # IN_PROGRESS: пацієнт свідомо обрав лікаря — робота розпочата одразу
        status=CaseStatusEnum.IN_PROGRESS,
    )
    db.add(case)
    await db.flush()

    await _attach_file_to_case(case.id, db_file.id, current_user.id, db)
    await _add_participant(case.id, current_user.id, db)
    await _add_participant(case.id, radiologist_id, db)

    await db.commit()
    await db.refresh(case)

    return {
        "case_id": case.id,
        "file_id": db_file.id,
        "status": case.status,
        "radiologist": {"id": radiologist.id, "name": rad_name},
        "message": f"Кейс створено. Рентгенолог {rad_name} отримав доступ до знімку",
    }
