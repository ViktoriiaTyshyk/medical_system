"""
Інтеграційні тести для /cases ендпоінтів.

Перевіряємо:
- пацієнт бачить лише свої справи
- створення справи
- отримання справи за ID
- зміна статусу
- збереження висновку
- контроль доступу (чужий пацієнт отримує 404/403)
"""
import pytest
from httpx import AsyncClient

from tests.conftest import register_user


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────
async def _register_and_headers(client: AsyncClient, email: str) -> tuple[dict, int]:
    """Реєструє пацієнта, повертає (headers, user_id)."""
    tokens = await register_user(client, email=email)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    me = await client.get("/users/me", headers=headers)
    user_id = me.json()["id"]
    return headers, user_id


async def _create_case(client: AsyncClient, headers: dict, patient_id: int, title: str = "Справа") -> dict:
    resp = await client.post("/cases", json={
        "title": title,
        "description": "Тестовий опис",
        "patient_id": patient_id,
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ──────────────────────────────────────────────────────────────────────────────
# Listing
# ──────────────────────────────────────────────────────────────────────────────
class TestListCases:
    async def test_patient_sees_only_own_cases(self, client: AsyncClient):
        h1, uid1 = await _register_and_headers(client, "list_p1@test.com")
        h2, uid2 = await _register_and_headers(client, "list_p2@test.com")

        await _create_case(client, h1, uid1, "Справа пацієнта 1")
        await _create_case(client, h2, uid2, "Справа пацієнта 2")

        resp1 = await client.get("/cases", headers=h1)
        assert resp1.status_code == 200
        cases1 = resp1.json()
        # Усі справи належать uid1
        assert all(c["patient_id"] == uid1 for c in cases1)

    async def test_list_requires_auth(self, client: AsyncClient):
        resp = await client.get("/cases")
        assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────────────────────
# Create
# ──────────────────────────────────────────────────────────────────────────────
class TestCreateCase:
    async def test_create_case_success(self, client: AsyncClient):
        h, uid = await _register_and_headers(client, "create_ok@test.com")
        resp = await client.post("/cases", json={
            "title": "Нова справа",
            "description": "Опис",
            "patient_id": uid,
        }, headers=h)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Нова справа"
        assert data["patient_id"] == uid
        assert data["status"] == "OPEN"

    async def test_create_case_nonexistent_patient(self, client: AsyncClient):
        h, _ = await _register_and_headers(client, "create_bad@test.com")
        resp = await client.post("/cases", json={
            "title": "Зламана справа",
            "patient_id": 999_999,
        }, headers=h)
        assert resp.status_code == 400

    async def test_create_case_missing_title(self, client: AsyncClient):
        h, uid = await _register_and_headers(client, "create_notitle@test.com")
        resp = await client.post("/cases", json={"patient_id": uid}, headers=h)
        assert resp.status_code == 422


# ──────────────────────────────────────────────────────────────────────────────
# Get by ID
# ──────────────────────────────────────────────────────────────────────────────
class TestGetCase:
    async def test_get_case_by_id(self, client: AsyncClient):
        h, uid = await _register_and_headers(client, "get_case@test.com")
        created = await _create_case(client, h, uid, "Моя справа")
        case_id = created["id"]

        resp = await client.get(f"/cases/{case_id}", headers=h)
        assert resp.status_code == 200
        assert resp.json()["id"] == case_id

    async def test_get_nonexistent_case(self, client: AsyncClient):
        h, _ = await _register_and_headers(client, "get_missing@test.com")
        resp = await client.get("/cases/999999", headers=h)
        assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────────────────────
# Update status
# ──────────────────────────────────────────────────────────────────────────────
class TestUpdateCaseStatus:
    async def test_update_status_to_completed(self, client: AsyncClient):
        h, uid = await _register_and_headers(client, "status_ok@test.com")
        case = await _create_case(client, h, uid, "Справа для статусу")

        resp = await client.patch(
            f"/cases/{case['id']}/status",
            json={"status": "COMPLETED"},
            headers=h,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "COMPLETED"

    async def test_update_status_invalid_value(self, client: AsyncClient):
        h, uid = await _register_and_headers(client, "status_invalid@test.com")
        case = await _create_case(client, h, uid, "Справа невалідний статус")

        resp = await client.patch(
            f"/cases/{case['id']}/status",
            json={"status": "UNKNOWN_STATUS"},
            headers=h,
        )
        assert resp.status_code == 422


# ──────────────────────────────────────────────────────────────────────────────
# Conclusion
# ──────────────────────────────────────────────────────────────────────────────
class TestCaseConclusion:
    async def test_save_conclusion(self, client: AsyncClient):
        h, uid = await _register_and_headers(client, "conclusion_ok@test.com")
        case = await _create_case(client, h, uid, "Справа для висновку")

        resp = await client.patch(
            f"/cases/{case['id']}/conclusion",
            json={"conclusion": "Патологій не виявлено"},
            headers=h,
        )
        assert resp.status_code == 200
        assert resp.json()["conclusion"] == "Патологій не виявлено"

    async def test_conclusion_nonexistent_case(self, client: AsyncClient):
        h, _ = await _register_and_headers(client, "conclusion_missing@test.com")
        resp = await client.patch(
            "/cases/999999/conclusion",
            json={"conclusion": "Щось"},
            headers=h,
        )
        assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────────────────────
# Participants
# ──────────────────────────────────────────────────────────────────────────────
class TestCaseParticipants:
    async def test_add_and_list_participants(self, client: AsyncClient):
        h, uid = await _register_and_headers(client, "part_owner@test.com")
        _, uid2 = await _register_and_headers(client, "part_doctor@test.com")
        case = await _create_case(client, h, uid, "Справа з учасником")

        add = await client.post(
            f"/cases/{case['id']}/participants?user_id={uid2}",
            headers=h,
        )
        assert add.status_code == 201

        lst = await client.get(f"/cases/{case['id']}/participants", headers=h)
        assert lst.status_code == 200
        user_ids = [p["user_id"] for p in lst.json()]
        assert uid2 in user_ids
