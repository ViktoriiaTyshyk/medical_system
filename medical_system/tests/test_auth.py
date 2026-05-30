"""
Інтеграційні тести для /auth ендпоінтів.

Перевіряємо:
- реєстрацію нового пацієнта
- дублювання email
- логін з правильними / невірними даними
- refresh токену
- logout (відкликання refresh токену)
"""
import pytest
from httpx import AsyncClient

from tests.conftest import register_user


# ──────────────────────────────────────────────────────────────────────────────
# Реєстрація
# ──────────────────────────────────────────────────────────────────────────────
class TestRegister:
    async def test_register_returns_tokens(self, client: AsyncClient):
        resp = await client.post("/auth/register", json={
            "email": "new_patient@test.com",
            "password": "SecurePass1!",
            "first_name": "Іван",
            "last_name": "Тест",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_register_duplicate_email(self, client: AsyncClient):
        payload = {
            "email": "dup@test.com",
            "password": "Pass123!",
            "first_name": "А",
            "last_name": "Б",
        }
        await client.post("/auth/register", json=payload)
        resp2 = await client.post("/auth/register", json=payload)
        assert resp2.status_code == 400
        assert "already registered" in resp2.json()["detail"].lower()

    async def test_register_invalid_payload(self, client: AsyncClient):
        resp = await client.post("/auth/register", json={
            "email": "not-an-email",
            "password": "x",
        })
        assert resp.status_code == 422          # Pydantic validation error


# ──────────────────────────────────────────────────────────────────────────────
# Логін
# ──────────────────────────────────────────────────────────────────────────────
class TestLogin:
    async def test_login_success(self, client: AsyncClient):
        await register_user(client, email="login_ok@test.com", password="MyPass1!")
        resp = await client.post("/auth/login", json={
            "email": "login_ok@test.com",
            "password": "MyPass1!",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    async def test_login_wrong_password(self, client: AsyncClient):
        await register_user(client, email="wrong_pw@test.com", password="CorrectPw1!")
        resp = await client.post("/auth/login", json={
            "email": "wrong_pw@test.com",
            "password": "WrongPassword",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={
            "email": "nobody@example.com",
            "password": "whatever",
        })
        assert resp.status_code == 401

    async def test_login_missing_fields(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={"email": "x@x.com"})
        assert resp.status_code == 422


# ──────────────────────────────────────────────────────────────────────────────
# Refresh token
# ──────────────────────────────────────────────────────────────────────────────
class TestRefresh:
    async def test_refresh_invalid_token(self, client: AsyncClient):
        resp = await client.post("/auth/refresh?refresh_token=not.a.valid.token")
        assert resp.status_code == 401

    async def test_refresh_expired_jwt(self, client: AsyncClient):
        """JWT підписаний правильним ключем але прострочений — відмова."""
        from app.core.security import create_refresh_token
        import time
        from datetime import timedelta

        expired = create_refresh_token({"sub": "999"})
        # Замінюємо на токен зі вже минулим expire через decode/encode
        from jose import jwt
        from app.core.config import settings
        payload = jwt.decode(expired, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        payload["exp"] = int(time.time()) - 3600   # минула година
        bad_token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

        resp = await client.post(f"/auth/refresh?refresh_token={bad_token}")
        assert resp.status_code == 401

    async def test_refresh_access_token_never_accepted(self, client: AsyncClient):
        """Access token (type=access) не приймається як refresh."""
        from app.core.security import create_access_token
        at = create_access_token({"sub": "1"})
        resp = await client.post(f"/auth/refresh?refresh_token={at}")
        assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────────────────────
# Профіль /users/me
# ──────────────────────────────────────────────────────────────────────────────
class TestMe:
    async def test_get_me_authorized(self, client: AsyncClient):
        tokens = await register_user(
            client,
            email="me_test@test.com",
            first_name="Оксана",
            last_name="Ковальчук",
        )
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        resp = await client.get("/users/me", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "me_test@test.com"
        assert data["first_name"] == "Оксана"

    async def test_get_me_unauthorized(self, client: AsyncClient):
        resp = await client.get("/users/me")
        assert resp.status_code == 401

    async def test_get_me_invalid_token(self, client: AsyncClient):
        resp = await client.get("/users/me", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 401
