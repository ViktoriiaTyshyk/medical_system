from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.case import Case, CaseStatusEnum
from app.models.case_participant import CaseParticipant
from app.models.case_file import CaseFile
from app.models.file import File as FileModel
from app.schemas.case import CaseCreate, CaseOut, CaseUpdate, CaseStatusUpdate, CaseConclusionUpdate, ParticipantOut
from app.repositories.case_repository import CaseRepository
from app.repositories.user_repository import UserRepository
from datetime import datetime
import os, shutil
from app.core.config import settings

router = APIRouter()


@router.post("", response_model=CaseOut, status_code=201)
async def create_case(
    data: CaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if patient exists
    user_repo = UserRepository(db)
    patient = await user_repo.get_by_id(data.patient_id)
    if not patient:
        raise HTTPException(status_code=400, detail=f"Patient with id {data.patient_id} does not exist")
    
    repo = CaseRepository(db)
    case = await repo.create(data, current_user.id)
    return case


@router.get("", response_model=List[CaseOut])
async def list_cases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = CaseRepository(db)
    return await repo.get_all_for_user(current_user.id)


@router.get("/{case_id}", response_model=CaseOut)
async def get_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = CaseRepository(db)
    case = await repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.patch("/{case_id}", response_model=CaseOut)
async def update_case(
    case_id: int,
    data: CaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = CaseRepository(db)
    case = await repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(case, field, value)
    await db.commit()
    await db.refresh(case)
    return case


@router.patch("/{case_id}/status", response_model=CaseOut)
async def update_case_status(
    case_id: int,
    data: CaseStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = CaseRepository(db)
    case = await repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    case.status = data.status
    if data.status == CaseStatusEnum.CLOSED:
        case.closed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(case)
    return case


@router.patch("/{case_id}/conclusion", response_model=CaseOut)
async def update_conclusion(
    case_id: int,
    data: CaseConclusionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = CaseRepository(db)
    case = await repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    case.conclusion = data.conclusion
    await db.commit()
    await db.refresh(case)
    return case


@router.post("/{case_id}/sign")
async def sign_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = CaseRepository(db)
    case = await repo.get_by_id(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    case.status = CaseStatusEnum.COMPLETED
    await db.commit()
    return {"detail": "Case signed and completed"}


@router.get("/{case_id}/participants", response_model=List[ParticipantOut])
async def get_participants(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CaseParticipant).where(CaseParticipant.case_id == case_id)
    )
    return result.scalars().all()


@router.post("/{case_id}/participants", status_code=201)
async def add_participant(
    case_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    participant = CaseParticipant(case_id=case_id, user_id=user_id)
    db.add(participant)
    await db.commit()
    return {"detail": "Participant added"}


@router.get("/{case_id}/files")
async def get_case_files(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CaseFile).options(selectinload(CaseFile.file)).where(CaseFile.case_id == case_id)
    )
    return result.scalars().all()


@router.post("/{case_id}/files", status_code=201)
async def upload_case_file(
    case_id: int,
    file: UploadFile = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    size = os.path.getsize(file_path)
    db_file = FileModel(
        owner_user_id=current_user.id,
        name=file.filename,
        mime_type=file.content_type,
        path=file_path,
        size=size,
    )
    db.add(db_file)
    await db.flush()
    case_file = CaseFile(case_id=case_id, file_id=db_file.id, uploaded_by=current_user.id)
    db.add(case_file)
    await db.commit()
    return {"detail": "File uploaded", "file_id": db_file.id}
