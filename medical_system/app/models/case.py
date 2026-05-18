import enum
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum as SAEnum, func, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base


class CaseStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CLOSED = "CLOSED"


class UrgencyEnum(str, enum.Enum):
    NORMAL = "NORMAL"   # здоровий або невизначене відхилення
    URGENT = "URGENT"   # виявлена конкретна патологія


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    conclusion = Column(Text, nullable=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(SAEnum(CaseStatusEnum), default=CaseStatusEnum.OPEN)
    urgency = Column(SAEnum(UrgencyEnum), default=UrgencyEnum.NORMAL, nullable=False)
    ai_result = Column(JSON, nullable=True)
    therapist_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    therapist_note = Column(Text, nullable=True)

    therapist = relationship("User", foreign_keys="Case.therapist_id")
    created_at = Column(DateTime, server_default=func.now())
    closed_at = Column(DateTime, nullable=True)

    patient = relationship("User", foreign_keys=[patient_id])
    participants = relationship("CaseParticipant", back_populates="case")
    messages = relationship("Message", back_populates="case")
    case_files = relationship("CaseFile", back_populates="case")
