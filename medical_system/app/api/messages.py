from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.message import Message, MessageTypeEnum
from app.models.message_attachment import MessageAttachment
from app.models.case_participant import CaseParticipant
from app.models.file import File as FileModel
from app.schemas.message import MessageCreate, MessageOut, MessageUpdate
from app.repositories.message_repository import MessageRepository
import os, shutil, uuid
from app.core.config import settings

router = APIRouter()


async def _check_participant(case_id: int, user_id: int, db: AsyncSession):
    """Перевіряє що користувач є учасником кейсу. Кидає 403 якщо ні."""
    result = await db.execute(
        select(CaseParticipant).where(
            CaseParticipant.case_id == case_id,
            CaseParticipant.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a participant of this case")


@router.get("/cases/{case_id}/messages", response_model=List[MessageOut])
async def get_messages(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _check_participant(case_id, current_user.id, db)
    repo = MessageRepository(db)
    return await repo.get_by_case(case_id)


@router.post("/cases/{case_id}/messages", response_model=MessageOut, status_code=201)
async def create_message(
    case_id: int,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _check_participant(case_id, current_user.id, db)
    repo = MessageRepository(db)
    return await repo.create(case_id, current_user.id, data)


@router.get("/{message_id}", response_model=MessageOut)
async def get_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = MessageRepository(db)
    msg = await repo.get_by_id(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    # перевірка участі у кейсі
    await _check_participant(msg.case_id, current_user.id, db)
    return msg


@router.patch("/{message_id}", response_model=MessageOut)
async def update_message(
    message_id: int,
    data: MessageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = MessageRepository(db)
    msg = await repo.get_by_id(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your message")
    return await repo.update(msg, data)


@router.delete("/{message_id}", status_code=204)
async def delete_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = MessageRepository(db)
    msg = await repo.get_by_id(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your message")
    await db.delete(msg)
    await db.commit()


@router.post("/{message_id}/attachments", status_code=201)
async def add_attachment(
    message_id: int,
    file: UploadFile = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = MessageRepository(db)
    msg = await repo.get_by_id(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    await _check_participant(msg.case_id, current_user.id, db)

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    unique_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)
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
    attachment = MessageAttachment(message_id=message_id, file_id=db_file.id)
    db.add(attachment)
    await db.commit()
    return {"detail": "Attachment added", "file_id": db_file.id}
