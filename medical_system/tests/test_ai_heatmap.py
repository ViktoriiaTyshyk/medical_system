"""
Unit-тести для генерації теплових карт (Grad-CAM / mock).

Ці тести не потребують GPU, PyTorch або реальних зображень.
Перевіряємо лише математичну / логічну частину.
"""
import math

import numpy as np
import pytest
from PIL import Image


# ──────────────────────────────────────────────────────────────────────────────
# Тест власне алгоритму mock-heatmap (без імпорту важкого AI-модуля)
# ──────────────────────────────────────────────────────────────────────────────
def _make_mock_heatmap(
    width: int = 224,
    height: int = 224,
    *,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """
    Спрощена копія логіки mock-heatmap з ai_analysis.py.
    Повертає float-масив [0..1] розміром (height, width).
    """
    if rng is None:
        rng = np.random.default_rng(42)

    xs = np.linspace(0, 1, width)
    ys = np.linspace(0, 1, height)
    X, Y = np.meshgrid(xs, ys)

    cx = rng.uniform(0.15, 0.85)
    cy = rng.uniform(0.20, 0.75)
    sigma = rng.uniform(0.10, 0.18)

    heatmap = np.exp(-((X - cx) ** 2 + (Y - cy) ** 2) / (2 * sigma ** 2))

    # Можливий другий центр (білатеральна патологія)
    if rng.random() < 0.4:
        cx2 = 1.0 - cx
        cy2 = cy + rng.uniform(-0.05, 0.05)
        sigma2 = sigma * rng.uniform(0.6, 0.9)
        heatmap += 0.6 * np.exp(
            -((X - cx2) ** 2 + (Y - cy2) ** 2) / (2 * sigma2 ** 2)
        )

    # Нормалізація [0..1]
    heatmap = heatmap / heatmap.max()
    return heatmap


class TestMockHeatmap:
    def test_output_shape(self):
        hm = _make_mock_heatmap(224, 224)
        assert hm.shape == (224, 224)

    def test_values_in_range(self):
        hm = _make_mock_heatmap()
        assert hm.min() >= 0.0
        assert hm.max() <= 1.0

    def test_max_is_one(self):
        hm = _make_mock_heatmap()
        assert math.isclose(hm.max(), 1.0, rel_tol=1e-6)

    def test_center_not_always_at_image_center(self):
        """
        Раніше баг: центр був завжди в середині зображення.
        Перевіряємо, що argmax може знаходитись будь-де.
        """
        centers = set()
        for seed in range(20):
            rng = np.random.default_rng(seed)
            hm = _make_mock_heatmap(64, 64, rng=rng)
            row, col = np.unravel_index(hm.argmax(), hm.shape)
            # Квантуємо до квадрантів 8×8 для порівняння
            centers.add((row // 8, col // 8))
        # Якщо всі argmax в одній точці — баг з центруванням
        assert len(centers) > 1, "Всі heatmap мають той самий центр (баг!)"

    def test_different_seeds_give_different_heatmaps(self):
        hm1 = _make_mock_heatmap(rng=np.random.default_rng(1))
        hm2 = _make_mock_heatmap(rng=np.random.default_rng(2))
        assert not np.allclose(hm1, hm2)

    def test_arbitrary_size(self):
        hm = _make_mock_heatmap(128, 64)
        assert hm.shape == (64, 128)
        assert hm.min() >= 0.0
        assert hm.max() <= 1.0


# ──────────────────────────────────────────────────────────────────────────────
# Тест утиліт роботи із зображеннями (PIL)
# ──────────────────────────────────────────────────────────────────────────────
def _overlay_heatmap(
    base: Image.Image, heatmap: np.ndarray, alpha: float = 0.5
) -> Image.Image:
    """
    Проста копія логіки накладання heatmap на рентген.
    Конвертує grayscale float-heatmap у RGBA і мікшує з base.
    """
    import matplotlib.cm as cm

    colored = cm.jet(heatmap)                       # (H, W, 4) float [0..1]
    colored_uint8 = (colored * 255).astype(np.uint8)
    heatmap_img = Image.fromarray(colored_uint8, "RGBA")
    heatmap_img = heatmap_img.resize(base.size, Image.BILINEAR)

    base_rgba = base.convert("RGBA")
    blended = Image.blend(base_rgba, heatmap_img, alpha=alpha)
    return blended


class TestHeatmapOverlay:
    def test_overlay_output_mode(self):
        base = Image.new("L", (224, 224), color=128)  # grayscale рентген
        hm   = _make_mock_heatmap(224, 224)
        result = _overlay_heatmap(base, hm)
        assert result.mode == "RGBA"

    def test_overlay_size_preserved(self):
        base = Image.new("L", (300, 200), color=0)
        hm   = _make_mock_heatmap(224, 224)
        result = _overlay_heatmap(base, hm, alpha=0.4)
        assert result.size == (300, 200)

    def test_overlay_alpha_zero_equals_base(self):
        """alpha=0 → результат = base (без heatmap)."""
        base = Image.new("RGB", (64, 64), color=(100, 150, 200))
        hm   = _make_mock_heatmap(64, 64)
        result = _overlay_heatmap(base, hm, alpha=0.0)
        base_rgba = base.convert("RGBA")
        # При alpha=0 пікселі мають збігатись з оригіналом
        arr_result = np.array(result)
        arr_base   = np.array(base_rgba)
        assert np.allclose(arr_result, arr_base, atol=1)


# ──────────────────────────────────────────────────────────────────────────────
# Тест декодування результату AI (business logic)
# ──────────────────────────────────────────────────────────────────────────────
MULTICLASS_LABELS = {
    "Atelectasis":  "Ателектаз",
    "Cardiomegaly": "Кардіомегалія",
    "Effusion":     "Плевральний випіт",
    "Pneumothorax": "Пневмоторакс",
    "Infiltration": "Інфільтрація",
    "Mass/Nodule":  "Пухлина / вузол",
    "Other":        "Інші / невизначено",
}


def _format_ai_summary(ai: dict) -> str:
    """Копія логіки форматування з ai_chat.py."""
    stage = ai.get("stage", "")
    if stage == "healthy":
        norm_pct = round((1 - ai.get("binary_prob", 0)) * 100, 1)
        return f"Патологій не виявлено (норма {norm_pct}%)"
    elif stage == "classified":
        top_label = MULTICLASS_LABELS.get(ai.get("top_class", ""), ai.get("top_class", ""))
        top_prob  = round(ai.get("top_prob", 0) * 100, 1)
        return f"Виявлено: {top_label} ({top_prob}%)"
    elif stage == "unclassifiable":
        abn_pct = round(ai.get("binary_prob", 0) * 100, 1)
        return f"Відхилення від норми ({abn_pct}%), патологія не класифікована"
    else:
        return "AI-аналіз не проводився"


class TestAISummaryFormat:
    def test_healthy_stage(self):
        result = _format_ai_summary({"stage": "healthy", "binary_prob": 0.08})
        assert "Патологій не виявлено" in result
        assert "92.0%" in result

    def test_classified_stage_known_label(self):
        result = _format_ai_summary({
            "stage": "classified",
            "top_class": "Pneumothorax",
            "top_prob": 0.87,
        })
        assert "Пневмоторакс" in result
        assert "87.0%" in result

    def test_classified_stage_unknown_label(self):
        """Невідомий клас показується як є."""
        result = _format_ai_summary({
            "stage": "classified",
            "top_class": "SomeNewDisease",
            "top_prob": 0.5,
        })
        assert "SomeNewDisease" in result

    def test_unclassifiable_stage(self):
        result = _format_ai_summary({"stage": "unclassifiable", "binary_prob": 0.65})
        assert "Відхилення від норми" in result
        assert "65.0%" in result

    def test_no_stage(self):
        result = _format_ai_summary({})
        assert result == "AI-аналіз не проводився"

    def test_binary_prob_boundary(self):
        """binary_prob=1.0 → норма 0%, binary_prob=0.0 → норма 100%."""
        r1 = _format_ai_summary({"stage": "healthy", "binary_prob": 1.0})
        assert "0.0%" in r1
        r2 = _format_ai_summary({"stage": "healthy", "binary_prob": 0.0})
        assert "100.0%" in r2
