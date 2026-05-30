from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.models.role import Role, RoleEnum
from app.models.refresh_token import RefreshToken
from app.models.password_reset_token import PasswordResetToken
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.core.dependencies import get_current_user
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
import hashlib
import secrets
import os
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        phone=data.phone,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
    )
    user.roles = []  # Initialize the relationship
    db.add(user)
    await db.flush()

    # Реєстрація доступна тільки для пацієнтів
    role_result = await db.execute(select(Role).where(Role.name == RoleEnum.PATIENT))
    role = role_result.scalar_one_or_none()
    if not role:
        role = Role(name=RoleEnum.PATIENT)
        db.add(role)
        await db.flush()

    user.roles.append(role)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token_str = create_refresh_token({"sub": str(user.id)})

    token_hash = hashlib.sha256(refresh_token_str.encode()).hexdigest()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(days=30),
    )
    db.add(rt)
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token_str)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.email == data.email)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.status.value == "INACTIVE":
        raise HTTPException(status_code=403, detail="User is inactive")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token_str = create_refresh_token({"sub": str(user.id)})

    token_hash = hashlib.sha256(refresh_token_str.encode()).hexdigest()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(days=30),
    )
    db.add(rt)
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token_str)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(refresh_token: str, db: AsyncSession = Depends(get_db)):
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.utcnow(),
        )
    )
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(status_code=401, detail="Refresh token not found or revoked")

    rt.revoked_at = datetime.utcnow()

    user_id = payload.get("sub")
    new_access = create_access_token({"sub": user_id})
    new_refresh_str = create_refresh_token({"sub": user_id})
    new_hash = hashlib.sha256(new_refresh_str.encode()).hexdigest()

    new_rt = RefreshToken(
        user_id=int(user_id),
        token_hash=new_hash,
        expires_at=datetime.utcnow() + timedelta(days=30),
    )
    db.add(new_rt)
    await db.commit()

    return TokenResponse(access_token=new_access, refresh_token=new_refresh_str)


@router.post("/logout")
async def logout(refresh_token: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    rt = result.scalar_one_or_none()
    if rt:
        rt.revoked_at = datetime.utcnow()
        await db.commit()
    return {"detail": "Logged out successfully"}


# ── Password reset ────────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _send_reset_email_sync(to_email: str, reset_link: str) -> None:
    gmail_user     = os.getenv("GMAIL_USER", "")
    gmail_password = os.getenv("GMAIL_APP_PASSWORD", "")

    if not gmail_user or not gmail_password:
        print(f"[RESET LINK] {reset_link}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Відновлення пароля — МедСкан АІ"
    msg["From"]    = f"МедСкан АІ <{gmail_user}>"
    msg["To"]      = to_email

    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1a56db">МедСкан АІ</h2>
      <p>Ми отримали запит на відновлення пароля для вашого облікового запису.</p>
      <p>Натисніть кнопку нижче, щоб встановити новий пароль.
         Посилання дійсне <strong>1 годину</strong>.</p>
      <a href="{reset_link}"
         style="display:inline-block;background:#1a56db;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Відновити пароль
      </a>
      <p style="color:#6b7280;font-size:13px">
        Якщо ви не надсилали цей запит — просто проігноруйте лист.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">МедСкан АІ — медична інформаційна система</p>
    </div>
    """
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(gmail_user, gmail_password)
        server.sendmail(gmail_user, to_email, msg.as_string())


async def _send_reset_email(to_email: str, reset_link: str) -> None:
    await asyncio.to_thread(_send_reset_email_sync, to_email, reset_link)


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    # Завжди повертаємо 200 — не розкриваємо чи існує email
    if not user:
        return {"detail": "Якщо email зареєстровано, надіслано лист із посиланням."}

    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=1)
    db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires))
    await db.commit()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={token}"
    await _send_reset_email(user.email, reset_link)

    return {"detail": "Якщо email зареєстровано, надіслано лист із посиланням."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token == data.token,
            PasswordResetToken.used.is_(False),
            PasswordResetToken.expires_at > datetime.utcnow(),
        )
    )
    reset_token = result.scalar_one_or_none()
    if not reset_token:
        raise HTTPException(status_code=400, detail="Посилання недійсне або вже використане.")

    user = await db.get(User, reset_token.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Користувача не знайдено.")

    user.password_hash = get_password_hash(data.new_password)
    reset_token.used = True
    await db.commit()

    return {"detail": "Пароль успішно змінено. Тепер ви можете увійти."}
