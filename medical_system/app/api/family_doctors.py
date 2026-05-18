from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List
from app.db.session import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.role import Role, RoleEnum
from app.models.user_role import UserRole
from app.models.user import User
from app.models.case import Case
from app.models.case_participant import CaseParticipant
from app.models.patient_profile import PatientProfile
from app.schemas.case import CaseOut

router = APIRouter()


@router.get("/list")
async def list_family_doctors(
    q: str = Query("", description="Пошук за іменем"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Список усіх терапевтів (для направлення рентгенологом)."""
    stmt = (
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(Role.name == RoleEnum.FAMILY_DOCTOR)
        .options(selectinload(User.family_doctor_profile))
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
    result = await db.execute(stmt)
    doctors = result.scalars().all()
    return [
        {
            "id": d.id,
            "first_name": d.first_name,
            "last_name": d.last_name,
            "email": d.email,
            "specialization": (
                d.family_doctor_profile.specialization if d.family_doctor_profile else None
            ),
        }
        for d in doctors
    ]


@router.get("/my-patients")
async def get_my_patients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.FAMILY_DOCTOR)),
):
    result = await db.execute(
        select(PatientProfile)
        .options(selectinload(PatientProfile.user))
        .where(PatientProfile.family_doctor_id == current_user.id)
    )
    profiles = result.scalars().all()
    return [p.user for p in profiles]


@router.get("/my-patients/{patient_id}")
async def get_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.FAMILY_DOCTOR)),
):
    result = await db.execute(
        select(PatientProfile)
        .options(selectinload(PatientProfile.user))
        .where(
            PatientProfile.user_id == patient_id,
            PatientProfile.family_doctor_id == current_user.id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")
    return profile.user


@router.get("/my-cases", response_model=List[CaseOut])
async def get_my_cases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.FAMILY_DOCTOR)),
):
    """Всі справи пацієнтів, у яких цей терапевт призначений у профілі (вся історія)."""
    result = await db.execute(
        select(Case)
        .join(PatientProfile, PatientProfile.user_id == Case.patient_id)
        .where(PatientProfile.family_doctor_id == current_user.id)
    )
    return result.scalars().all()


@router.get("/my-cases/{case_id}", response_model=CaseOut)
async def get_my_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.FAMILY_DOCTOR)),
):
    result = await db.execute(
        select(Case)
        .join(PatientProfile, PatientProfile.user_id == Case.patient_id)
        .where(Case.id == case_id, PatientProfile.family_doctor_id == current_user.id)
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case
