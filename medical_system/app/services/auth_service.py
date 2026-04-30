from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.user import User
from app.models.role import Role, RoleEnum
from app.models.refresh_token import RefreshToken
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.schemas.auth import RegisterRequest, TokenResponse
from datetime import datetime, timedelta
import hashlib


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: RegisterRequest) -> TokenResponse:
        result = await self.db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise ValueError("Email already registered")

        user = User(
            email=data.email,
            phone=data.phone,
            password_hash=get_password_hash(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
        )
        user.roles = []  # Initialize the relationship
        self.db.add(user)
        await self.db.flush()

        role_result = await self.db.execute(select(Role).where(Role.name == data.role))
        role = role_result.scalar_one_or_none()
        if not role:
            role = Role(name=data.role)
            self.db.add(role)
            await self.db.flush()

        user.roles.append(role)
        await self.db.commit()
        await self.db.refresh(user)

        return await self._issue_tokens(user.id)

    async def login(self, email: str, password: str) -> TokenResponse:
        result = await self.db.execute(
            select(User).options(selectinload(User.roles)).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Invalid credentials")
        return await self._issue_tokens(user.id)

    async def _issue_tokens(self, user_id: int) -> TokenResponse:
        access = create_access_token({"sub": str(user_id)})
        refresh = create_refresh_token({"sub": str(user_id)})
        token_hash = hashlib.sha256(refresh.encode()).hexdigest()
        rt = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        self.db.add(rt)
        await self.db.commit()
        return TokenResponse(access_token=access, refresh_token=refresh)
