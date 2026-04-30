import enum
from sqlalchemy import Column, Integer, String, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.db.base import Base


class BloodTypeEnum(str, enum.Enum):
    A_POS = "A_POS"
    A_NEG = "A_NEG"
    B_POS = "B_POS"
    B_NEG = "B_NEG"
    AB_POS = "AB_POS"
    AB_NEG = "AB_NEG"
    O_POS = "O_POS"
    O_NEG = "O_NEG"


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    medical_record_number = Column(String, unique=True, nullable=True)
    insurance_number = Column(String, nullable=True)
    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    blood_type = Column(SAEnum(BloodTypeEnum), nullable=True)
    family_doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    user = relationship("User", back_populates="patient_profile", foreign_keys=[user_id])
    family_doctor = relationship("User", foreign_keys=[family_doctor_id])
