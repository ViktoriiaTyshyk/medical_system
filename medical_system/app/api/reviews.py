from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
from app.db.session import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.role import RoleEnum
from app.models.case import Case, CaseStatusEnum
from app.models.radiologist_review import RadiologistReview

router = APIRouter()


class ReviewCreate(BaseModel):
    radiologist_id: int
    rating: int           # 1-5
    comment: Optional[str] = None


class ReviewStats(BaseModel):
    average: float
    count: int


@router.post("/cases/{case_id}/review", status_code=201)
async def submit_review(
    case_id: int,
    data: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.PATIENT)),
):
    """Пацієнт залишає відгук про рентгенолога після завершення справи."""
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(400, "Рейтинг має бути від 1 до 5")

    case_res = await db.execute(
        select(Case).where(Case.id == case_id, Case.patient_id == current_user.id)
    )
    case = case_res.scalar_one_or_none()
    if not case:
        raise HTTPException(404, "Справу не знайдено")
    if case.status not in (CaseStatusEnum.COMPLETED, CaseStatusEnum.CLOSED):
        raise HTTPException(400, "Справа ще не завершена")

    existing = await db.execute(select(RadiologistReview).where(RadiologistReview.case_id == case_id))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Відгук для цієї справи вже залишено")

    review = RadiologistReview(
        patient_id=current_user.id,
        radiologist_id=data.radiologist_id,
        case_id=case_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    await db.commit()
    return {"detail": "Відгук збережено", "rating": data.rating}


@router.get("/radiologists/{radiologist_id}/reviews")
async def get_radiologist_reviews(
    radiologist_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Статистика рейтингу та список відгуків рентгенолога."""
    stats = await db.execute(
        select(
            func.avg(RadiologistReview.rating).label("average"),
            func.count(RadiologistReview.id).label("count"),
        ).where(RadiologistReview.radiologist_id == radiologist_id)
    )
    row = stats.one()
    avg = round(float(row.average), 1) if row.average else 0.0
    count = row.count or 0

    reviews_res = await db.execute(
        select(RadiologistReview)
        .where(RadiologistReview.radiologist_id == radiologist_id)
        .order_by(RadiologistReview.created_at.desc())
        .limit(20)
    )
    reviews = reviews_res.scalars().all()

    return {
        "average": avg,
        "count": count,
        "reviews": [
            {
                "id": r.id,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at,
            }
            for r in reviews
        ],
    }
