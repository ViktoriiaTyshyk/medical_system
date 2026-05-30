from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token      = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used       = Column(Boolean, default=False, nullable=False)

    user = relationship("User")
