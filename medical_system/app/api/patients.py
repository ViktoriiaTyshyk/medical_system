from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.db.session import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.role import Role, RoleEnum
from app.models.user_role import UserRole
from app.models.patient_profile import PatientProfile
from app.models.case import Case
from app.schemas.case import CaseOut
from app.schemas.user import UserOut


class SetDoctorRequest(BaseModel):
    family_doctor_id: int

router = APIRouter()


@router.patch("/my-doctor")
async def set_my_doctor(
    data: SetDoctorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    """Пацієнт призначає собі терапевта."""
    res = await db.execute(
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(User.id == data.family_doctor_id, Role.name == RoleEnum.FAMILY_DOCTOR)
    )
    doctor = res.scalar_one_or_none()
    if not doctor:
        raise HTTPException(404, "Терапевта не знайдено")

    profile_res = await db.execute(
        select(PatientProfile).where(PatientProfile.user_id == current_user.id)
    )
    profile = profile_res.scalar_one_or_none()
    if not profile:
        profile = PatientProfile(user_id=current_user.id)
        db.add(profile)

    profile.family_doctor_id = data.family_doctor_id
    await db.commit()
    return {
        "detail": f"Терапевта призначено: {doctor.first_name} {doctor.last_name}",
        "family_doctor_id": doctor.id,
        "therapist_name": f"{doctor.first_name} {doctor.last_name}",
    }


@router.get("/my-doctor")
async def get_my_doctor(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    result = await db.execute(
        select(PatientProfile).where(PatientProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile or not profile.family_doctor_id:
        raise HTTPException(status_code=404, detail="Терапевта не призначено")
    doctor = await db.get(User, profile.family_doctor_id)
    return doctor


@router.get("/my-cases", response_model=List[CaseOut])
async def get_my_cases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    result = await db.execute(
        select(Case).where(Case.patient_id == current_user.id)
    )
    return result.scalars().all()


@router.get("/my-cases/{case_id}", response_model=CaseOut)
async def get_my_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    result = await db.execute(
        select(Case).where(Case.id == case_id, Case.patient_id == current_user.id)
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.get("/{patient_id}")
async def get_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(User).options(selectinload(User.patient_profile)).where(User.id == patient_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Patient not found")
    return user
