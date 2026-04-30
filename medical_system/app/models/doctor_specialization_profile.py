from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base


class DoctorSpecializationProfile(Base):
    __tablename__ = "doctors_specialization_profiles"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    specialization_id = Column(Integer, ForeignKey("specializations.id", ondelete="CASCADE"), primary_key=True)

    specialization = relationship("Specialization", back_populates="doctors")
