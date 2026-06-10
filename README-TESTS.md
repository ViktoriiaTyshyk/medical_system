# Тестування МедСкан АІ

## Структура тестів

```
medical_system/tests/
  conftest.py          ← SQLite in-memory fixtures, HTTP-клієнт
  test_security.py     ← unit-тести JWT і хешування паролів (без БД)
  test_auth.py         ← інтеграційні тести /auth/* ендпоінтів
  test_cases.py        ← інтеграційні тести /cases/* ендпоінтів
  test_ai_heatmap.py   ← unit-тести генерації теплових карт та AI-логіки

medical_frontend/src/__tests__/
  setup.ts             ← підключення jest-dom матчерів
  utils.test.ts        ← тести cn(), fmtDate(), fmtTime(), esc()
  auth-store.test.ts   ← тести Zustand auth store
  Badge.test.tsx       ← тести компонента Badge
```

---

## Backend (Python / pytest)

### Вимоги
```
pip install aiosqlite pytest pytest-asyncio httpx
```
або всі залежності разом:
```bash
cd medical_system
pip install -r requirements.txt
```

### Запуск
```bash
cd medical_system

# Усі тести
pytest

# Конкретний файл
pytest tests/test_security.py

# Певний клас або тест
pytest tests/test_auth.py::TestLogin::test_login_success

# З виводом (verbose)
pytest -v

# Тільки провалені тести
pytest --lf
```

### Архітектура тестового середовища

Тести **не потребують запущеної PostgreSQL**.  
`conftest.py` замінює PostgreSQL на **SQLite in-memory** через `aiosqlite`.

- `engine` — фікстура рівня сесії: один движок на весь pytest-запуск
- `db` — фікстура рівня функції: кожен тест отримує власну транзакцію яка **скочується назад** після тесту. БД залишається чистою між тестами.
- `client` — `httpx.AsyncClient` з підміненою залежністю `get_db`

```
pytest запустив тест
  └─ engine (один раз: create tables)
       └─ db (кожен тест: BEGIN → yield → ROLLBACK)
            └─ client (підміняє get_db → тестова сесія)
```

---

## Frontend (TypeScript / Vitest)

### Вимоги
```bash
cd medical_frontend
npm install
```
_(нові пакети: vitest, @testing-library/react, @testing-library/jest-dom, jsdom)_

### Запуск
```bash
cd medical_frontend

# Один раз (CI)
npm test

# Watch mode (розробка)
npm run test:watch

# З UI у браузері
npm run test:ui

# Coverage звіт
npm run coverage
```

### Що тестується

| Файл | Покриття |
|------|----------|
| `utils.test.ts` | `cn()`, `fmtDate()`, `fmtTime()`, `esc()` |
| `auth-store.test.ts` | `setAuth`, `clearAuth`, визначення ролі за пріоритетом |
| `Badge.test.tsx` | рендеринг, всі 6 варіантів, onClick, className |

---

## Чому такий підхід?

| Рішення | Чому |
|---------|------|
| **SQLite in-memory** для backend | Тести запускаються без Docker/PostgreSQL — на будь-якому ноутбуці за секунди |
| **Транзакційна ізоляція** між тестами | Кожен тест чистий; нема потреби у `teardown` |
| **pytest-asyncio + asyncio_mode=auto** | Мінімум бойлерплейту для `async def test_*` |
| **Vitest** для frontend | Сумісний з Vite (той самий конфіг, аліаси `@/`); швидший за Jest |
| **jsdom** | Браузерне середовище без реального браузера |
| **@testing-library/react** | Тести "як користувач" (DOM-запити), не "як розробник" (internal state) |
