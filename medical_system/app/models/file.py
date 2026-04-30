from sqlalchemy import Column, Integer, String, BigInteger, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)
    path = Column(String, nullable=False)
    size = Column(BigInteger, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    owner = relationship("User", back_populates="files")
    message_attachments = relationship("MessageAttachment", back_populates="file")
    case_files = relationship("CaseFile", back_populates="file")
