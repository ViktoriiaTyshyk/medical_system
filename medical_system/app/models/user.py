import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Date, DateTime, Enum as SAEnum, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class SexEnum(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class UserStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    sex = Column(SAEnum(SexEnum), nullable=True)
    status = Column(SAEnum(UserStatusEnum), default=UserStatusEnum.ACTIVE)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    roles = relationship("Role", secondary="user_roles", back_populates="users")
    patient_profile = relationship("PatientProfile", back_populates="user", uselist=False, foreign_keys="PatientProfile.user_id")
    radiologist_profile = relationship("RadiologistProfile", back_populates="user", uselist=False)
    family_doctor_profile = relationship("FamilyDoctorProfile", back_populates="user", uselist=False)
    refresh_tokens = relationship("RefreshToken", back_populates="user")
    files = relationship("File", back_populates="owner")
