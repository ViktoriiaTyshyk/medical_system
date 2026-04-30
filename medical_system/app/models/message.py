import enum
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum as SAEnum, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class MessageTypeEnum(str, enum.Enum):
    TEXT = "TEXT"
    FILE = "FILE"
    SYSTEM = "SYSTEM"


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    sender_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message_type = Column(SAEnum(MessageTypeEnum), default=MessageTypeEnum.TEXT)
    text = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    edited_at = Column(DateTime, nullable=True)

    case = relationship("Case", back_populates="messages")
    sender = relationship("User")
    attachments = relationship("MessageAttachment", back_populates="message")
