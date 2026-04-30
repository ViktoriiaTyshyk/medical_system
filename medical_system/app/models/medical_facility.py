from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class MedicalFacility(Base):
    __tablename__ = "medical_facilities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    radiologist_profiles = relationship("RadiologistProfile", back_populates="facility")
    family_doctor_profiles = relationship("FamilyDoctorProfile", back_populates="facility")
