from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.file import File as FileModel
from app.repositories.file_repository import FileRepository
from app.core.config import settings
import os, shutil

router = APIRouter()


@router.post("/upload", status_code=201)
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    size = os.path.getsize(file_path)
    repo = FileRepository(db)
    db_file = await repo.create(
        owner_user_id=current_user.id,
        name=file.filename,
        mime_type=file.content_type,
        path=file_path,
        size=size,
    )
    return {"file_id": db_file.id, "name": db_file.name}


@router.get("/{file_id}")
async def get_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = FileRepository(db)
    db_file = await repo.get_by_id(file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.exists(db_file.path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(db_file.path, media_type=db_file.mime_type, filename=db_file.name)


@router.delete("/{file_id}", status_code=204)
async def delete_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = FileRepository(db)
    db_file = await repo.get_by_id(file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    if db_file.owner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your file")
    if os.path.exists(db_file.path):
        os.remove(db_file.path)
    await db.delete(db_file)
    await db.commit()
