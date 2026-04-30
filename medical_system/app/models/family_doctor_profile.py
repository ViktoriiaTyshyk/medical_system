from sqlalchemy import Column, Integer, String, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.radiologist_profile import AvailabilityStatusEnum


class FamilyDoctorProfile(Base):
    __tablename__ = "family_doctor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    license_number = Column(String, unique=True, nullable=True)
    facility_id = Column(Integer, ForeignKey("medical_facilities.id"), nullable=True)
    clinic_name = Column(String, nullable=True)
    years_of_experience = Column(Integer, nullable=True)
    digital_signature_id = Column(Integer, ForeignKey("digital_signatures.id"), nullable=True)
    availability_status = Column(SAEnum(AvailabilityStatusEnum), default=AvailabilityStatusEnum.AVAILABLE)

    user = relationship("User", back_populates="family_doctor_profile")
    facility = relationship("MedicalFacility", back_populates="family_doctor_profiles")
