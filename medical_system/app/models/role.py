import enum
from sqlalchemy import Column, Integer, String, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.db.base import Base


class RoleEnum(str, enum.Enum):
    PATIENT = "PATIENT"
    RADIOLOGIST = "RADIOLOGIST"
    FAMILY_DOCTOR = "FAMILY_DOCTOR"
    ADMIN = "ADMIN"


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(SAEnum(RoleEnum), unique=True, nullable=False)

    users = relationship("User", secondary="user_roles", back_populates="roles")
