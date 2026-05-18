from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import Optional
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.role import Role, RoleEnum
from app.models.user_role import UserRole
from app.schemas.user import UserOut, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/search")
async def search_users(
    q: str = Query("", description="Пошук за іменем або прізвищем"),
    role: Optional[str] = Query(None, description="Фільтр за роллю: PATIENT, RADIOLOGIST, FAMILY_DOCTOR"),
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Пошук користувачів за іменем/прізвищем.
    Повертає id, first_name, last_name, email.
    """
    stmt = select(User)
    if role:
        stmt = (
            stmt
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(Role.name == role)
        )
    if q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                (User.first_name + " " + User.last_name).ilike(term),
            )
        )
    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [
        {"id": u.id, "first_name": u.first_name, "last_name": u.last_name, "email": u.email}
        for u in users
    ]


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
