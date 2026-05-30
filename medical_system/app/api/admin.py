from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sa_delete, update as sa_update
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
from app.models.doctor_specialization_profile import DoctorSpecializationProfile
from app.schemas.user import UserOut, UserUpdate
from app.schemas.admin import (
    AdminUserCreate, AdminUserStatusUpdate,
    SpecializationCreate, SpecializationOut,
    FacilityCreate, FacilityOut,
)
from pydantic import BaseModel
from typing import Optional, List as PyList
from app.models.radiologist_profile import RadiologistProfile, AvailabilityStatusEnum
from app.models.family_doctor_profile import FamilyDoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.case import Case
from app.models.case_file import CaseFile
from app.models.file import File
from app.models.refresh_token import RefreshToken


class DoctorCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: str                               # RADIOLOGIST або FAMILY_DOCTOR
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    sex: Optional[str] = None
    # Профіль рентгенолога
    license_number: Optional[str] = None
    department: Optional[str] = None
    years_of_experience: Optional[int] = None
    availability_status: Optional[str] = None
    facility_id: Optional[int] = None
    # Профіль терапевта
    clinic_name: Optional[str] = None


class SpecializationAssign(BaseModel):
    specialization_ids: PyList[int] = []

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
    from datetime import date as date_type
    from app.models.user import UserStatusEnum

    user = User(
        email=data.email,
        phone=data.phone,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        date_of_birth=date_type.fromisoformat(data.date_of_birth) if data.date_of_birth else None,
        sex=data.sex or None,
    )
    if data.status:
        user.status = UserStatusEnum(data.status)
    db.add(user)
    await db.flush()

    for role_name in data.roles:
        result = await db.execute(select(Role).where(Role.name == role_name))
        role = result.scalar_one_or_none()
        if not role:
            role = Role(name=role_name)
            db.add(role)
            await db.flush()
        db.add(UserRole(user_id=user.id, role_id=role.id))

    # Якщо пацієнт — створюємо профіль одразу
    is_patient = any(r == RoleEnum.PATIENT for r in data.roles)
    if is_patient and any([data.blood_type, data.address, data.insurance_number,
                           data.emergency_contact_name, data.emergency_contact_phone]):
        db.add(PatientProfile(
            user_id=user.id,
            blood_type=data.blood_type or None,
            address=data.address or None,
            insurance_number=data.insurance_number or None,
            emergency_contact_name=data.emergency_contact_name or None,
            emergency_contact_phone=data.emergency_contact_phone or None,
        ))

    await db.commit()
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


@router.post("/doctors", status_code=201)
async def create_doctor(
    data: DoctorCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    """Адмін створює лікаря (рентгенолог або терапевт) з профілем."""
    if data.role not in (RoleEnum.RADIOLOGIST.value, RoleEnum.FAMILY_DOCTOR.value):
        raise HTTPException(400, "Роль має бути RADIOLOGIST або FAMILY_DOCTOR")

    exists = await db.execute(select(User).where(User.email == data.email))
    if exists.scalar_one_or_none():
        raise HTTPException(400, "Email вже використовується")

    from datetime import date as date_type
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        date_of_birth=date_type.fromisoformat(data.date_of_birth) if data.date_of_birth else None,
        sex=data.sex or None,
    )
    db.add(user)
    await db.flush()

    role_res = await db.execute(select(Role).where(Role.name == data.role))
    role = role_res.scalar_one_or_none()
    if not role:
        role = Role(name=data.role)
        db.add(role)
        await db.flush()
    db.add(UserRole(user_id=user.id, role_id=role.id))

    avail = data.availability_status or AvailabilityStatusEnum.AVAILABLE.value

    if data.role == RoleEnum.RADIOLOGIST.value:
        db.add(RadiologistProfile(
            user_id=user.id,
            license_number=data.license_number,
            department=data.department,
            years_of_experience=data.years_of_experience,
            availability_status=avail,
            facility_id=data.facility_id,
        ))
    elif data.role == RoleEnum.FAMILY_DOCTOR.value:
        db.add(FamilyDoctorProfile(
            user_id=user.id,
            license_number=data.license_number,
            clinic_name=data.clinic_name,
            years_of_experience=data.years_of_experience,
            availability_status=avail,
            facility_id=data.facility_id,
        ))

    await db.commit()
    return {"id": user.id, "email": user.email, "first_name": user.first_name, "last_name": user.last_name}


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


# ── Doctor Specializations ─────────────────────────────────────────────────────
@router.get("/doctors/{user_id}/specializations")
async def get_doctor_specializations(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    res = await db.execute(
        select(DoctorSpecializationProfile)
        .options(selectinload(DoctorSpecializationProfile.specialization))
        .where(DoctorSpecializationProfile.user_id == user_id)
    )
    return [{"id": d.specialization.id, "name": d.specialization.name} for d in res.scalars().all()]


@router.put("/doctors/{user_id}/specializations")
async def set_doctor_specializations(
    user_id: int,
    data: SpecializationAssign,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    await db.execute(
        sa_delete(DoctorSpecializationProfile).where(DoctorSpecializationProfile.user_id == user_id)
    )
    for spec_id in data.specialization_ids:
        db.add(DoctorSpecializationProfile(user_id=user_id, specialization_id=spec_id))
    await db.commit()
    return {"detail": "Specializations updated"}


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


# ── Delete endpoints ───────────────────────────────────────────────────────────

@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_role(RoleEnum.ADMIN)),
):
    """Видалити користувача та всі пов'язані дані."""
    if current.id == user_id:
        raise HTTPException(status_code=400, detail="Не можна видалити власний акаунт")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. Обнулити therapist_id у справах (FK без CASCADE)
    await db.execute(
        sa_update(Case).where(Case.therapist_id == user_id).values(therapist_id=None)
    )
    # 2. Видалити записи case_files де uploaded_by = user_id (NOT NULL, без CASCADE)
    await db.execute(sa_delete(CaseFile).where(CaseFile.uploaded_by == user_id))

    # 3. Явно видалити junction-таблиці
    await db.execute(sa_delete(UserRole).where(UserRole.user_id == user_id))
    await db.execute(sa_delete(DoctorSpecializationProfile).where(DoctorSpecializationProfile.user_id == user_id))
    await db.execute(sa_delete(PatientProfile).where(PatientProfile.user_id == user_id))
    await db.execute(sa_delete(RefreshToken).where(RefreshToken.user_id == user_id))

    # 4. Видалити користувача — CASCADE на БД рівні прибирає решту:
    #    radiologist_profile, family_doctor_profile, messages.sender_user_id,
    #    case_participants.user_id, cases.patient_id (→ messages, case_files, reviews),
    #    files.owner_user_id, radiologist_reviews
    await db.execute(sa_delete(User).where(User.id == user_id))
    await db.commit()


@router.delete("/cases/{case_id}", status_code=204)
async def delete_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    """Видалити справу та всі вкладені дані (повідомлення, файли, учасники)."""
    case = await db.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Зберегти ID файлів перед видаленням (cascade прибере CaseFile, але File — ні)
    file_ids_res = await db.execute(select(CaseFile.file_id).where(CaseFile.case_id == case_id))
    file_ids = file_ids_res.scalars().all()

    # Видалити справу — CASCADE: messages, case_files, case_participants, radiologist_reviews
    await db.execute(sa_delete(Case).where(Case.id == case_id))

    # Видалити фізичні файли
    if file_ids:
        await db.execute(sa_delete(File).where(File.id.in_(file_ids)))

    await db.commit()


@router.delete("/facilities/{facility_id}", status_code=204)
async def delete_facility(
    facility_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    facility = await db.get(MedicalFacility, facility_id)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    await db.execute(sa_delete(MedicalFacility).where(MedicalFacility.id == facility_id))
    await db.commit()


@router.delete("/specializations/{spec_id}", status_code=204)
async def delete_specialization(
    spec_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    spec = await db.get(Specialization, spec_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Specialization not found")
    # Видалити прив'язки лікарів до цієї спеціалізації
    await db.execute(
        sa_delete(DoctorSpecializationProfile).where(DoctorSpecializationProfile.specialization_id == spec_id)
    )
    await db.execute(sa_delete(Specialization).where(Specialization.id == spec_id))
    await db.commit()


# ── Admin Cases listing ────────────────────────────────────────────────────────

@router.get("/cases")
async def list_all_cases(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(RoleEnum.ADMIN)),
):
    """Повний список усіх справ для адміністратора."""
    result = await db.execute(
        select(Case).order_by(Case.id.desc())
    )
    cases = result.scalars().all()
    return [
        {
            "id":         c.id,
            "title":      c.title,
            "status":     c.status,
            "urgency":    c.urgency,
            "patient_id": c.patient_id,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in cases
    ]
