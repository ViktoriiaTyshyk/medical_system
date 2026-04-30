from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.message import MessageTypeEnum


class MessageCreate(BaseModel):
    text: Optional[str] = None
    message_type: MessageTypeEnum = MessageTypeEnum.TEXT


class MessageUpdate(BaseModel):
    text: str


class MessageOut(BaseModel):
    id: int
    case_id: int
    sender_user_id: int
    message_type: str
    text: Optional[str]
    created_at: datetime
    edited_at: Optional[datetime]

    class Config:
        from_attributes = True
