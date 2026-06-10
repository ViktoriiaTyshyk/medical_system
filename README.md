# Медична інформаційна система

Веб-застосунок для взаємодії пацієнтів, сімейних лікарів та рентгенологів з AI-аналізом рентгенівських знімків легень.

---

## Зміст

- [Стек технологій](#стек-технологій)
- [Архітектура](#архітектура)
- [Ролі користувачів](#ролі-користувачів)
- [Функціональність](#функціональність)
- [Локальний запуск](#локальний-запуск)
- [Запуск тестів](#запуск-тестів)
- [Розгортання у хмарі](#розгортання-у-хмарі)
- [Структура проекту](#структура-проекту)
- [Змінні середовища](#змінні-середовища)

---

## Стек технологій

### Backend
| Компонент | Технологія |
|---|---|
| Мова | Python 3.12 |
| Фреймворк | FastAPI 0.111 |
| База даних | PostgreSQL 15 |
| ORM | SQLAlchemy 2.0 (async) |
| Міграції | Alembic |
| Валідація схем | Pydantic v2 |
| Автентифікація | JWT (access + refresh токени) |
| Хешування паролів | passlib / bcrypt |
| AI валідація знімків | CLIP (openai/clip-vit-base-patch32) |
| AI аналіз патологій | PyTorch, torchxrayvision |
| AI чат | Groq API (llama3) |
| PDF-звіти | ReportLab |
| Тестування | pytest + pytest-asyncio |
| Контейнеризація | Docker, docker-compose |

### Frontend
| Компонент | Технологія |
|---|---|
| Мова | TypeScript |
| Фреймворк | React 18 |
| Збірка | Vite |
| Стилі | Tailwind CSS |
| Стан | Zustand |
| HTTP-клієнт | Axios |

### Інфраструктура
| Компонент | Технологія |
|---|---|
| Хмарна платформа | Microsoft Azure |
| Запуск контейнерів | Azure Container Apps |
| База даних у хмарі | Azure Database for PostgreSQL |
| Реєстр образів | Docker Hub |
| CI/CD | GitHub Actions |

---

## Архітектура

```
┌─────────────────────────────────┐
│         medical_frontend        │
│  React + TypeScript + Vite      │
│  (Azure Container Apps)         │
└────────────┬────────────────────┘
             │ HTTPS / REST API
┌────────────▼────────────────────┐
│         medical_system          │
│  FastAPI + SQLAlchemy + PyTorch │
│  (Azure Container Apps)         │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│     Azure PostgreSQL            │
│  (керована база даних)          │
└─────────────────────────────────┘
```

**CI/CD pipeline (GitHub Actions):**
1. Push до гілки `master`
2. Збірка Docker-образів backend + frontend
3. Push образів до Docker Hub
4. Деплой до Azure Container Apps через `az containerapp update`

---

## Ролі користувачів

| Роль | Можливості |
|---|---|
| `PATIENT` | Реєстрація, перегляд власних кейсів, чат, перегляд висновків та призначень |
| `RADIOLOGIST` | Перегляд призначених кейсів, додавання висновку, AI-аналіз знімків, Grad-CAM теплова карта |
| `FAMILY_DOCTOR` | Ведення пацієнтів, відкриття/закриття кейсів, призначення рентгенологів, написання призначень, PDF-звіт |
| `ADMIN` | Управління користувачами, ролями, профілями |

---

## Функціональність

### Автентифікація
- Реєстрація та вхід з JWT (access 30 хв + refresh 30 днів)
- Скидання пароля через email
- Захист маршрутів за роллю

### Кейси (медичні справи)
- Створення кейсу пацієнтом або лікарем
- Статуси: `OPEN` → `IN_PROGRESS` → `CLOSED`
- Вкладення файлів (рентгени, документи)
- Чат між учасниками кейсу
- Висновок рентгенолога
- Призначення терапевта (видно пацієнту)

### AI-аналіз рентгену
- Валідація зображення: CLIP перевіряє що завантажено саме рентген легень (відхиляє звичайні фото)
- Бінарна класифікація: норма / відхилення
- Мультикласова класифікація: Atelectasis, Cardiomegaly, Effusion, Pneumothorax та ін.
- Grad-CAM теплова карта — візуалізація зони ураження
- AI-чат для пояснення результатів (Groq)
- Генерація PDF-звіту

### PDF-звіт
- Ім'я пацієнта, дата, патології, ймовірності
- Вбудована теплова карта

---

## Локальний запуск

### Вимоги
- Python 3.12+
- Node.js 18+
- PostgreSQL 15 (або Docker)

### 1. Клонування репозиторію

```bash
git clone <repo-url>
cd max_med
```

### 2. Backend

```bash
cd medical_system
cp .env.example .env
# Відредагуйте .env (DATABASE_URL, SECRET_KEY, GROQ_API_KEY)

pip install -r requirements.txt
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

alembic upgrade head
uvicorn app.main:app --reload
```

API: http://localhost:8000  
Swagger: http://localhost:8000/docs

### 3. Frontend

```bash
cd medical_frontend
npm install
npm run dev
```

UI: http://localhost:5173

### 4. Через Docker Compose (все разом)

```bash
cd medical_system
docker-compose up --build
```

- Frontend: http://localhost:3000  
- Backend API: http://localhost:8000

---

## Запуск тестів

```bash
cd medical_system
pip install -r requirements.txt
python -m pytest -v
```

Тестові файли:
- `tests/test_auth.py` — реєстрація, вхід, токени
- `tests/test_cases.py` — CRUD кейсів, доступ за роллю
- `tests/test_security.py` — захист маршрутів
- `tests/test_ai_heatmap.py` — AI-аналіз, генерація теплової карти

Тести використовують SQLite в памʼяті (aiosqlite) — PostgreSQL не потрібен.

---

## Розгортання у хмарі

### Необхідні секрети GitHub

| Секрет | Опис |
|---|---|
| `DOCKERHUB_USERNAME` | Логін Docker Hub |
| `DOCKERHUB_TOKEN` | Access Token Docker Hub |
| `AZURE_CREDENTIALS` | JSON сервіс-принципалу Azure |

### Створення Azure сервіс-принципала

```bash
az ad sp create-for-rbac \
  --name med-deploy-sp \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/med-diploma-rg \
  --sdk-auth
```

Скопіюйте JSON-вивід у `AZURE_CREDENTIALS`.

### Ручний деплой

```bash
# Backend
docker build -t viktoria17568y/med-backend:latest ./medical_system
docker push viktoria17568y/med-backend:latest
az containerapp update \
  --name med-backend \
  --resource-group med-diploma-rg \
  --image docker.io/viktoria17568y/med-backend:latest

# Frontend
docker build -t viktoria17568y/med-frontend:latest ./medical_frontend
docker push viktoria17568y/med-frontend:latest
az containerapp update \
  --name med-frontend \
  --resource-group med-diploma-rg \
  --image docker.io/viktoria17568y/med-frontend:latest
```

### Перегляд логів

```bash
az containerapp logs show \
  --name med-backend \
  --resource-group med-diploma-rg \
  --tail 50
```

---

## Структура проекту

```
max_med/
├── medical_system/              # Backend (FastAPI)
│   ├── app/
│   │   ├── api/                 # Роутери: auth, cases, users, ai_analysis, ...
│   │   ├── core/                # Конфігурація, JWT, залежності
│   │   ├── db/                  # Сесія БД, Alembic міграції
│   │   ├── models/              # SQLAlchemy моделі
│   │   ├── schemas/             # Pydantic схеми
│   │   ├── repositories/        # Запити до БД
│   │   ├── services/            # Бізнес-логіка
│   │   ├── ml_models/           # .pth моделі (binary + multiclass)
│   │   └── main.py
│   ├── tests/                   # pytest тести
│   ├── uploads/                 # Завантажені файли
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   └── alembic.ini
│
├── medical_frontend/            # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── pages/               # Login, Register, Dashboard, CaseDetail, ...
│   │   ├── components/          # UI-компоненти
│   │   ├── store/               # Zustand (auth)
│   │   └── lib/                 # Утиліти
│   ├── Dockerfile
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
└── .github/
    └── workflows/
        └── deploy.yml           # CI/CD: build → push → deploy
```

---

## Змінні середовища

Файл `medical_system/.env` (скопіювати з `.env.example`):

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/medical_db
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
UPLOAD_DIR=uploads
GROQ_API_KEY=gsk_...
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.azurecontainerapps.io
```

---

## Обліковий запис адміністратора (за замовчуванням)

Створюється автоматично при першому запуску:

- Email: `admin@med.com`
- Пароль: `123456`

Змінити після першого входу.
