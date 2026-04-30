from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.case import Case, CaseStatusEnum
from app.models.case_participant import CaseParticipant
from app.models.case_file import CaseFile
from app.schemas.case import CaseCreate


class CaseRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, case_id: int) -> Optional[Case]:
        result = await self.db.execute(
            select(Case)
            .options(selectinload(Case.participants), selectinload(Case.case_files))
            .where(Case.id == case_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self) -> List[Case]:
        result = await self.db.execute(select(Case))
        return result.scalars().all()

    async def get_all_for_user(self, user_id: int) -> List[Case]:
        result = await self.db.execute(
            select(Case)
            .outerjoin(CaseParticipant, CaseParticipant.case_id == Case.id)
            .where(
                (Case.patient_id == user_id) | (CaseParticipant.user_id == user_id)
            )
            .distinct()
        )
        return result.scalars().all()

    async def get_by_patient(self, patient_id: int) -> List[Case]:
        result = await self.db.execute(select(Case).where(Case.patient_id == patient_id))
        return result.scalars().all()

    async def get_by_participant(self, user_id: int) -> List[Case]:
        result = await self.db.execute(
            select(Case)
            .join(CaseParticipant, CaseParticipant.case_id == Case.id)
            .where(CaseParticipant.user_id == user_id)
        )
        return result.scalars().all()

    async def create(self, data: CaseCreate, creator_id: int) -> Case:
        case = Case(
            title=data.title,
            description=data.description,
            patient_id=data.patient_id,
        )
        self.db.add(case)
        await self.db.commit()
        await self.db.refresh(case)
        # Add creator as participant
        participant = CaseParticipant(case_id=case.id, user_id=creator_id)
        self.db.add(participant)
        await self.db.commit()
        return case

    async def add_participant(self, case_id: int, user_id: int) -> CaseParticipant:
        participant = CaseParticipant(case_id=case_id, user_id=user_id)
        self.db.add(participant)
        await self.db.commit()
        await self.db.refresh(participant)
        return participant

    async def get_participants(self, case_id: int) -> List[CaseParticipant]:
        result = await self.db.execute(
            select(CaseParticipant).where(CaseParticipant.case_id == case_id)
        )
        return result.scalars().all()

    async def add_case_file(self, case_id: int, file_id: int, uploaded_by: int) -> CaseFile:
        cf = CaseFile(case_id=case_id, file_id=file_id, uploaded_by=uploaded_by)
        self.db.add(cf)
        await self.db.commit()
        await self.db.refresh(cf)
        return cf

    async def get_case_files(self, case_id: int) -> List[CaseFile]:
        result = await self.db.execute(
            select(CaseFile).where(CaseFile.case_id == case_id)
        )
        return result.scalars().all()
