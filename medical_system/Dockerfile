FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/* \
 || echo "fonts-dejavu-core not installed, PDF will use fallback font"

COPY requirements.txt .

# Основні залежності
RUN pip install --no-cache-dir \
    --trusted-host pypi.org \
    --trusted-host files.pythonhosted.org \
    --timeout 300 \
    --retries 5 \
    -r requirements.txt

# torch: спочатку з локальних wheels (без мережі), якщо є — інакше CPU-only з PyTorch CDN
COPY wheels/ /tmp/wheels/
RUN if ls /tmp/wheels/torch*.whl 1>/dev/null 2>&1; then \
        pip install --no-cache-dir /tmp/wheels/*.whl \
        && echo "torch installed from local wheels"; \
    else \
        pip install --no-cache-dir --timeout 300 --retries 3 \
        torch torchvision \
        --index-url https://download.pytorch.org/whl/cpu \
        || echo "torch not installed — mock AI буде використано"; \
    fi

# torchxrayvision та CLIP встановлюються після torch (залежать від нього)
RUN pip install --no-cache-dir --timeout 300 --retries 3 \
    torchxrayvision>=1.0.0 \
    || echo "torchxrayvision not installed"

# Завантажити CLIP-ваги під час збірки образу (не в рантаймі)
RUN python -c "\
from transformers import CLIPModel, CLIPProcessor; \
CLIPModel.from_pretrained('openai/clip-vit-base-patch32'); \
CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32'); \
print('CLIP weights cached')" \
    || echo "CLIP pre-download failed — will download at runtime"

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
