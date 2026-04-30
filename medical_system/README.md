# Medical Information System — Backend

Backend для медичної платформи взаємодії пацієнта, сімейного лікаря та рентгенолога.

## Стек технологій

- **Python 3.12+**
- **FastAPI** — REST API
- **PostgreSQL** — база даних
- **SQLAlchemy 2.0** — ORM (async)
- **Alembic** — міграції БД
- **Pydantic v2** — валідація схем
- **JWT** — access/refresh токени
- **passlib/bcrypt** — хешування паролів
- **Docker + docker-compose** — контейнеризація
- **Pytest** — тестування

## Швидкий старт

### 1. Клонування та налаштування

```bash
cp .env.example .env
# Відредагуйте .env під ваші налаштування
```

### 2. Запуск через Docker

```bash
docker-compose up --build
```

API буде доступне за адресою: http://localhost:8000

Swagger документація: http://localhost:8000/docs

### 3. Локальний запуск

```bash
pip install -r requirements.txt
# Переконайтесь що PostgreSQL запущений
alembic upgrade head
uvicorn app.main:app --reload
```

### 4. Міграції

```bash
alembic revision --autogenerate -m "init"
alembic upgrade head
```

### 5. Тести

```bash
pytest tests/
```

## Структура проекту

```
app/
├── api/          — FastAPI роутери
├── core/         — конфігурація, безпека, JWT
├── db/           — сесія БД, міграції (Alembic)
├── models/       — SQLAlchemy моделі
├── schemas/      — Pydantic схеми
├── repositories/ — робота з БД
├── services/     — бізнес-логіка
└── main.py
```

## Ролі користувачів

| Роль | Доступ |
|------|--------|
| `PATIENT` | Власний профіль, кейси, чат |
| `RADIOLOGIST` | Призначені кейси, висновки, чат |
| `FAMILY_DOCTOR` | Пацієнти, кейси, чат |
| `ADMIN` | Повний адміністративний доступ |

## API Endpoints

Повна документація доступна через Swagger: `/docs`

- `POST /auth/register` — реєстрація
- `POST /auth/login` — вхід
- `POST /auth/refresh` — оновлення токена
- `GET /cases` — список кейсів
- `POST /cases` — створення кейсу
- `GET /cases/{id}/messages` — повідомлення кейсу
- та інші...
