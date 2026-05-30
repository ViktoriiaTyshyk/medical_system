"""
Конфігурація тестового середовища.

Використовує SQLite in-memory через aiosqlite замість PostgreSQL,
тому тести запускаються без зовнішньої БД.
"""
# ── bcrypt 4.x / passlib 1.7.x compatibility patch ───────────────────────────
# Проблема: passlib 1.7.4 + bcrypt 4.x несумісні:
#
# • passlib читає bcrypt.__about__.__version__ → AttributeError (видалено у 4.0)
# • passlib.detect_wrap_bug() хешує 225-байтний тестовий рядок
#   (перевіряє старий баг переповнення) — bcrypt 4.x строго обмежує 72 байти
#   і кидає ValueError замість тихого обрізання.
#
# Рішення: патчимо bcrypt.hashpw до будь-яких імпортів app/passlib,
# щоб він мовчки обрізав паролі довші за 72 байти (поведінка bcrypt 3.x).
# Це відновлює попередню семантику тільки для тестового середовища.
import bcrypt as _bcrypt_module

if not hasattr(_bcrypt_module, '__about__'):
    _bcrypt_module.__about__ = type('_About', (), {
        '__version__': _bcrypt_module.__version__,
    })()

_orig_hashpw = _bcrypt_module.hashpw

def _compat_hashpw(password: bytes, salt: bytes) -> bytes:
    """bcrypt 4.x tightly enforces 72-byte limit. Restore silent-truncation for tests."""
    if isinstance(password, bytes) and len(password) > 72:
        password = password[:72]
    return _orig_hashpw(password, salt)

_bcrypt_module.hashpw = _compat_hashpw
# ─────────────────────────────────────────────────────────────────────────────

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db.base import Base
from app.db.session import get_db

# ──────────────────────────────────────────────────────────────────────────────
# Engine
# ──────────────────────────────────────────────────────────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
async def engine():
    """Один движок на всю сесію тестів (SQLite in-memory)."""
    eng = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )
    async with eng.begin() as conn:
        # Вмикаємо foreign keys у SQLite
        await conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


# ──────────────────────────────────────────────────────────────────────────────
# DB session — кожен тест отримує чисту транзакцію, яка скочується назад
# ──────────────────────────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def db(engine) -> AsyncSession:
    """
    Ізольована сесія для кожного тесту.
    Після тесту транзакція відкочується, БД залишається чистою.
    """
    connection = await engine.connect()
    transaction = await connection.begin()

    SessionFactory = async_sessionmaker(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    session = SessionFactory()
    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await connection.close()


# ──────────────────────────────────────────────────────────────────────────────
# HTTP-клієнт — підміняє залежність get_db на тестову сесію
# ──────────────────────────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncClient:
    """AsyncClient, прив'язаний до тестової БД."""

    async def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# Helpers — фабрики тестових даних
# ──────────────────────────────────────────────────────────────────────────────
async def register_user(
    client: AsyncClient,
    *,
    email: str,
    password: str = "Test1234!",
    first_name: str = "Тест",
    last_name: str = "Юзер",
) -> dict:
    """Реєструє пацієнта і повертає токени."""
    resp = await client.post("/auth/register", json={
        "email": email,
        "password": password,
        "first_name": first_name,
        "last_name": last_name,
    })
    assert resp.status_code == 201, resp.text
    return resp.json()


async def auth_headers(client: AsyncClient, email: str, password: str = "Test1234!") -> dict:
    """Логінить користувача та повертає заголовки Authorization."""
    tokens = await register_user(client, email=email, password=password)
    return {"Authorization": f"Bearer {tokens['access_token']}"}
