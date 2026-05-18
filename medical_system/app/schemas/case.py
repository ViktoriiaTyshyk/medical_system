from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel
from app.models.case import CaseStatusEnum, UrgencyEnum


class CaseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    patient_id: int


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class CaseStatusUpdate(BaseModel):
    status: CaseStatusEnum


class CaseConclusionUpdate(BaseModel):
    conclusion: str


class ParticipantOut(BaseModel):
    id: int
    case_id: int
    user_id: int
    joined_at: datetime

    class Config:
        from_attributes = True


class CaseOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    conclusion: Optional[str]
    patient_id: int
    status: str
    urgency: str
    ai_result: Optional[Any] = None
    therapist_id: Optional[int] = None
    therapist_note: Optional[str] = None
    created_at: datetime
    closed_at: Optional[datetime]

    class Config:
        from_attributes = True
