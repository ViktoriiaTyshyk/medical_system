from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.file import File


class FileRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, file_id: int) -> Optional[File]:
        result = await self.db.execute(select(File).where(File.id == file_id))
        return result.scalar_one_or_none()

    async def create(self, owner_user_id: int, name: str, mime_type: str, path: str, size: int) -> File:
        db_file = File(
            owner_user_id=owner_user_id,
            name=name,
            mime_type=mime_type,
            path=path,
            size=size,
        )
        self.db.add(db_file)
        await self.db.commit()
        await self.db.refresh(db_file)
        return db_file

    async def delete(self, file: File) -> None:
        await self.db.delete(file)
        await self.db.commit()
