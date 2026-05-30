"""
Unit-тести для модуля безпеки (без БД).

Перевіряємо:
- хешування паролів
- верифікацію паролів
- генерацію та декодування JWT
- тип токена (access / refresh)
- прострочений токен
"""
import time
from datetime import timedelta

import pytest
from jose import jwt

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.core.config import settings


# ──────────────────────────────────────────────────────────────────────────────
# Паролі
# ──────────────────────────────────────────────────────────────────────────────
class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        hashed = get_password_hash("mysecret")
        assert hashed != "mysecret"

    def test_verify_correct_password(self):
        hashed = get_password_hash("correct_password")
        assert verify_password("correct_password", hashed) is True

    def test_verify_wrong_password(self):
        hashed = get_password_hash("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_same_password_different_hashes(self):
        """bcrypt генерує різні хеші навіть для однакових паролів (сіль)."""
        h1 = get_password_hash("password")
        h2 = get_password_hash("password")
        assert h1 != h2

    def test_long_password_within_limit(self):
        """bcrypt обмежує 72 байти — перевіряємо рядок рівно 72 символи."""
        pw = "a" * 72
        hashed = get_password_hash(pw)
        assert verify_password(pw, hashed) is True
        assert verify_password("a" * 71, hashed) is False


# ──────────────────────────────────────────────────────────────────────────────
# JWT
# ──────────────────────────────────────────────────────────────────────────────
class TestJWT:
    def test_access_token_contains_sub(self):
        token = create_access_token({"sub": "42"})
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "42"

    def test_access_token_type(self):
        token = create_access_token({"sub": "1"})
        payload = decode_token(token)
        assert payload["type"] == "access"

    def test_refresh_token_type(self):
        token = create_refresh_token({"sub": "1"})
        payload = decode_token(token)
        assert payload["type"] == "refresh"

    def test_access_and_refresh_tokens_differ(self):
        access  = create_access_token({"sub": "1"})
        refresh = create_refresh_token({"sub": "1"})
        assert access != refresh

    def test_decode_invalid_token_returns_none(self):
        result = decode_token("totally.invalid.token")
        assert result is None

    def test_decode_tampered_token_returns_none(self):
        token   = create_access_token({"sub": "1"})
        tampered = token[:-4] + "XXXX"
        assert decode_token(tampered) is None

    def test_expired_token_returns_none(self):
        """Токен із від'ємним expire одразу вважається простроченим."""
        token = create_access_token({"sub": "99"}, expires_delta=timedelta(seconds=-1))
        assert decode_token(token) is None

    def test_custom_claims_preserved(self):
        token = create_access_token({"sub": "5", "role": "ADMIN"})
        payload = decode_token(token)
        assert payload["role"] == "ADMIN"

    def test_algorithm_matches_settings(self):
        """Токен, підписаний іншим ключем, не проходить верифікацію."""
        token = jwt.encode(
            {"sub": "1", "type": "access"},
            "wrong-secret-key",
            algorithm=settings.ALGORITHM,
        )
        assert decode_token(token) is None
