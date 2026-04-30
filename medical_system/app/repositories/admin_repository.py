from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.specialization import Specialization
from app.models.medical_facility import MedicalFacility


class AdminRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_users(self):
        result = await self.db.execute(select(User))
        return result.scalars().all()

    async def list_specializations(self):
        result = await self.db.execute(select(Specialization))
        return result.scalars().all()

    async def list_facilities(self):
        result = await self.db.execute(select(MedicalFacility))
        return result.scalars().all()

    async def get_user(self, user_id: int):
        return await self.db.get(User, user_id)
