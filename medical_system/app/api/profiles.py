from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.radiologist_profile import RadiologistProfile
from app.models.family_doctor_profile import FamilyDoctorProfile
from app.models.doctor_specialization_profile import DoctorSpecializationProfile
from app.schemas.profiles import (
    PatientProfileOut, PatientProfileUpdate,
    RadiologistProfileOut, RadiologistProfileUpdate,
    FamilyDoctorProfileOut, FamilyDoctorProfileUpdate,
)

router = APIRouter()


@router.get("/doctor/{user_id}/specializations")
async def get_doctor_specializations_public(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    res = await db.execute(
        select(DoctorSpecializationProfile)
        .options(selectinload(DoctorSpecializationProfile.specialization))
        .where(DoctorSpecializationProfile.user_id == user_id)
    )
    return [{"id": d.specialization.id, "name": d.specialization.name} for d in res.scalars().all()]


@router.get("/patient/{user_id}", response_model=PatientProfileOut)
async def get_patient_profile(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        return PatientProfile(user_id=user_id)
    return profile


@router.patch("/patient/{user_id}", response_model=PatientProfileOut)
async def update_patient_profile(user_id: int, data: PatientProfileUpdate,
                                  db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Немає доступу до цього профілю")
    result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = PatientProfile(user_id=user_id)
        db.add(profile)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/radiologist/{user_id}", response_model=RadiologistProfileOut)
async def get_radiologist_profile(user_id: int, db: AsyncSession = Depends(get_db),
                                   _: User = Depends(get_current_user)):
    result = await db.execute(select(RadiologistProfile).where(RadiologistProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.patch("/radiologist/{user_id}", response_model=RadiologistProfileOut)
async def update_radiologist_profile(user_id: int, data: RadiologistProfileUpdate,
                                      db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(RadiologistProfile).where(RadiologistProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = RadiologistProfile(user_id=user_id)
        db.add(profile)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/family-doctor/{user_id}", response_model=FamilyDoctorProfileOut)
async def get_family_doctor_profile(user_id: int, db: AsyncSession = Depends(get_db),
                                    _: User = Depends(get_current_user)):
    result = await db.execute(select(FamilyDoctorProfile).where(FamilyDoctorProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.patch("/family-doctor/{user_id}", response_model=FamilyDoctorProfileOut)
async def update_family_doctor_profile(user_id: int, data: FamilyDoctorProfileUpdate,
                                        db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(FamilyDoctorProfile).where(FamilyDoctorProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = FamilyDoctorProfile(user_id=user_id)
        db.add(profile)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return profile
