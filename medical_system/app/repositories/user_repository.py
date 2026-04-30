from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.user import User
from app.models.role import Role, RoleEnum


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> Optional[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.roles)).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.roles)).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_all(self) -> List[User]:
        result = await self.db.execute(select(User).options(selectinload(User.roles)))
        return result.scalars().all()

    async def create(self, email: str, password_hash: str, first_name: str,
                     last_name: str, phone: Optional[str] = None) -> User:
        user = User(
            email=email,
            password_hash=password_hash,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def assign_role(self, user: User, role_name: RoleEnum) -> User:
        result = await self.db.execute(select(Role).where(Role.name == role_name))
        role = result.scalar_one_or_none()
        if not role:
            role = Role(name=role_name)
            self.db.add(role)
            await self.db.flush()
        user.roles.append(role)
        await self.db.commit()
        await self.db.refresh(user)
        return user
