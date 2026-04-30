from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from app.models.user import SexEnum, UserStatusEnum
from app.models.role import RoleEnum


class RoleOut(BaseModel):
    id: int
    name: RoleEnum

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: int
    email: str
    phone: Optional[str]
    first_name: str
    last_name: str
    date_of_birth: Optional[date]
    sex: Optional[SexEnum]
    status: UserStatusEnum
    created_at: datetime
    roles: List[RoleOut] = []

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    sex: Optional[SexEnum] = None
