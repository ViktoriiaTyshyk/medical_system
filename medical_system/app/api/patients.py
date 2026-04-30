from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.db.session import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.role import RoleEnum
from app.models.patient_profile import PatientProfile
from app.models.case import Case
from app.schemas.case import CaseOut
from app.schemas.user import UserOut

router = APIRouter()


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
        raise HTTPException(status_code=404, detail="No family doctor assigned")
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
