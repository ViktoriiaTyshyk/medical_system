from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.case_repository import CaseRepository
from app.schemas.case import CaseCreate, CaseOut
from app.models.case import Case


class CaseService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CaseRepository(db)

    async def create_case(self, data: CaseCreate, creator_id: int) -> Case:
        return await self.repo.create(data, creator_id)

    async def get_case(self, case_id: int) -> Case:
        case = await self.repo.get_by_id(case_id)
        if not case:
            raise ValueError("Case not found")
        return case

    async def list_cases_for_user(self, user_id: int):
        return await self.repo.get_all_for_user(user_id)
