from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.db.session import get_db
from app.core.dependencies import require_role
from app.models.role import RoleEnum
from app.models.user import User
from app.models.case import Case
from app.models.case_participant import CaseParticipant
from app.schemas.case import CaseOut

router = APIRouter()


@router.get("/my-cases", response_model=List[CaseOut])
async def get_my_cases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RADIOLOGIST)),
):
    result = await db.execute(
        select(Case)
        .join(CaseParticipant, CaseParticipant.case_id == Case.id)
        .where(CaseParticipant.user_id == current_user.id)
    )
    return result.scalars().all()


@router.get("/my-cases/{case_id}", response_model=CaseOut)
async def get_my_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RADIOLOGIST)),
):
    result = await db.execute(
        select(Case)
        .join(CaseParticipant, CaseParticipant.case_id == Case.id)
        .where(Case.id == case_id, CaseParticipant.user_id == current_user.id)
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case
