from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.message import Message, MessageTypeEnum
from app.models.message_attachment import MessageAttachment
from app.schemas.message import MessageCreate, MessageUpdate


class MessageRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, message_id: int) -> Optional[Message]:
        result = await self.db.execute(select(Message).where(Message.id == message_id))
        return result.scalar_one_or_none()

    async def get_by_case(self, case_id: int) -> List[Message]:
        result = await self.db.execute(
            select(Message).where(Message.case_id == case_id).order_by(Message.created_at)
        )
        return result.scalars().all()

    async def create(self, case_id: int, sender_user_id: int, data: MessageCreate) -> Message:
        msg = Message(
            case_id=case_id,
            sender_user_id=sender_user_id,
            text=data.text,
            message_type=data.message_type,
        )
        self.db.add(msg)
        await self.db.commit()
        await self.db.refresh(msg)
        return msg

    async def update(self, message: Message, data: MessageUpdate) -> Message:
        message.text = data.text
        message.edited_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(message)
        return message

    async def delete(self, message: Message) -> None:
        await self.db.delete(message)
        await self.db.commit()

    async def add_attachment(self, message_id: int, file_id: int) -> MessageAttachment:
        att = MessageAttachment(message_id=message_id, file_id=file_id)
        self.db.add(att)
        await self.db.commit()
        await self.db.refresh(att)
        return att
