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




Змінити після першого входу.
