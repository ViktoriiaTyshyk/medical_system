from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.db.session import get_db
from app.core.dependencies import require_role
from app.core.security import get_password_hash
from app.models.role import Role, RoleEnum
from app.models.user import User
from app.models.specialization import Specialization
from app.models.medical_facility import MedicalFacility
from app.models.user_role import UserRole
from app.schemas.user import UserOut, UserUpdate
from app.schemas.admin import (
    AdminUserCreate, AdminUserStatusUpdate,
    SpecializationCreate, SpecializationOut,
    FacilityCreate, FacilityOut,
)

router = APIRouter()


# ── Users ──────────────────────────────────────────────────────────────────────
@router.get("/users", response_model=List[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    result = await db.execute(select(User).options(selectinload(User.roles)))
    return result.scalars().all()


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(
    data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    user = User(
        email=data.email,
        phone=data.phone,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
    )
    db.add(user)
    await db.flush()
    for role_name in data.roles:
        result = await db.execute(select(Role).where(Role.name == role_name))
        role = result.scalar_one_or_none()
        if not role:
            role = Role(name=role_name)
            db.add(role)
            await db.flush()
            user_role = UserRole(user_id=user.id, role_id=role.id)
            db.add(user_role)
    await db.commit()
    await db.refresh(user)
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == user.id)
    )
    return result.scalar_one()


@router.get("/users/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == user_id)
    )
    return result.scalar_one()


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    data: AdminUserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = data.status
    await db.commit()
    return {"detail": "Status updated"}


# ── Roles ──────────────────────────────────────────────────────────────────────
@router.get("/roles")
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    result = await db.execute(select(Role))
    return result.scalars().all()


# ── Specializations ────────────────────────────────────────────────────────────
@router.get("/specializations", response_model=List[SpecializationOut])
async def list_specializations(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    result = await db.execute(select(Specialization))
    return result.scalars().all()


@router.post("/specializations", response_model=SpecializationOut, status_code=201)
async def create_specialization(
    data: SpecializationCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    spec = Specialization(name=data.name)
    db.add(spec)
    await db.commit()
    await db.refresh(spec)
    return spec


@router.patch("/specializations/{spec_id}", response_model=SpecializationOut)
async def update_specialization(
    spec_id: int,
    data: SpecializationCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    spec = await db.get(Specialization, spec_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Specialization not found")
    spec.name = data.name
    await db.commit()
    await db.refresh(spec)
    return spec


# ── Facilities ─────────────────────────────────────────────────────────────────
@router.get("/facilities", response_model=List[FacilityOut])
async def list_facilities(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    result = await db.execute(select(MedicalFacility))
    return result.scalars().all()


@router.post("/facilities", response_model=FacilityOut, status_code=201)
async def create_facility(
    data: FacilityCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    facility = MedicalFacility(**data.model_dump())
    db.add(facility)
    await db.commit()
    await db.refresh(facility)
    return facility


@router.get("/facilities/{facility_id}", response_model=FacilityOut)
async def get_facility(
    facility_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    facility = await db.get(MedicalFacility, facility_id)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    return facility


@router.patch("/facilities/{facility_id}", response_model=FacilityOut)
async def update_facility(
    facility_id: int,
    data: FacilityCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    facility = await db.get(MedicalFacility, facility_id)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(facility, field, value)
    await db.commit()
    await db.refresh(facility)
    return facility
