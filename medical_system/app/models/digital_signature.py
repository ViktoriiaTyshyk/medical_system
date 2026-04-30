import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class SignatureStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"


class DigitalSignature(Base):
    __tablename__ = "digital_signatures"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    certificate_number = Column(String, unique=True, nullable=False)
    issued_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    status = Column(SAEnum(SignatureStatusEnum), default=SignatureStatusEnum.ACTIVE)
