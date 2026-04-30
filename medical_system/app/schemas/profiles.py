from typing import Optional
from pydantic import BaseModel
from app.models.patient_profile import BloodTypeEnum
from app.models.radiologist_profile import AvailabilityStatusEnum


class PatientProfileOut(BaseModel):
    id: int
    user_id: int
    medical_record_number: Optional[str]
    insurance_number: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    address: Optional[str]
    blood_type: Optional[BloodTypeEnum]
    family_doctor_id: Optional[int]

    class Config:
        from_attributes = True


class PatientProfileUpdate(BaseModel):
    medical_record_number: Optional[str] = None
    insurance_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    address: Optional[str] = None
    blood_type: Optional[BloodTypeEnum] = None
    family_doctor_id: Optional[int] = None


class RadiologistProfileOut(BaseModel):
    id: int
    user_id: int
    license_number: Optional[str]
    facility_id: Optional[int]
    department: Optional[str]
    years_of_experience: Optional[int]
    availability_status: AvailabilityStatusEnum

    class Config:
        from_attributes = True


class RadiologistProfileUpdate(BaseModel):
    license_number: Optional[str] = None
    facility_id: Optional[int] = None
    department: Optional[str] = None
    years_of_experience: Optional[int] = None
    availability_status: Optional[AvailabilityStatusEnum] = None


class FamilyDoctorProfileOut(BaseModel):
    id: int
    user_id: int
    license_number: Optional[str]
    facility_id: Optional[int]
    clinic_name: Optional[str]
    years_of_experience: Optional[int]
    availability_status: AvailabilityStatusEnum

    class Config:
        from_attributes = True


class FamilyDoctorProfileUpdate(BaseModel):
    license_number: Optional[str] = None
    facility_id: Optional[int] = None
    clinic_name: Optional[str] = None
    years_of_experience: Optional[int] = None
    availability_status: Optional[AvailabilityStatusEnum] = None
