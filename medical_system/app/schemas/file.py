from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class FileOut(BaseModel):
    id: int
    owner_user_id: int
    name: str
    mime_type: Optional[str]
    size: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
