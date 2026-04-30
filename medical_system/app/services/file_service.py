import os
import shutil
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.file_repository import FileRepository
from app.core.config import settings


class FileService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = FileRepository(db)

    async def save_upload(self, file: UploadFile, owner_user_id: int):
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        size = os.path.getsize(file_path)
        return await self.repo.create(
            owner_user_id=owner_user_id,
            name=file.filename,
            mime_type=file.content_type,
            path=file_path,
            size=size,
        )

    async def delete_file(self, file_id: int, user_id: int):
        db_file = await self.repo.get_by_id(file_id)
        if not db_file:
            raise ValueError("File not found")
        if db_file.owner_user_id != user_id:
            raise PermissionError("Not your file")
        if os.path.exists(db_file.path):
            os.remove(db_file.path)
        await self.db.delete(db_file)
        await self.db.commit()
