from sqlalchemy import Column, Integer, ForeignKey, Text, CheckConstraint, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class RadiologistReview(Base):
    __tablename__ = "radiologist_reviews"

    id             = Column(Integer, primary_key=True, index=True)
    patient_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    radiologist_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    case_id        = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, unique=True)
    rating         = Column(Integer, nullable=False)
    comment        = Column(Text, nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="review_rating_range"),
    )

    patient     = relationship("User", foreign_keys=[patient_id])
    radiologist = relationship("User", foreign_keys=[radiologist_id])
