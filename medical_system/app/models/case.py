import enum
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum as SAEnum, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class CaseStatusEnum(str, enum.Enum):
    PENDING = "PENDING"       # Запропонований пацієнтом через AI-аналіз, очікує рішення лікаря
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CLOSED = "CLOSED"


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    conclusion = Column(Text, nullable=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(SAEnum(CaseStatusEnum), default=CaseStatusEnum.OPEN)
    created_at = Column(DateTime, server_default=func.now())
    closed_at = Column(DateTime, nullable=True)

    patient = relationship("User", foreign_keys=[patient_id])
    participants = relationship("CaseParticipant", back_populates="case")
    messages = relationship("Message", back_populates="case")
    case_files = relationship("CaseFile", back_populates="case")
