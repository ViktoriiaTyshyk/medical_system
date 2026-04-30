from typing import Optional, List
from pydantic import BaseModel, EmailStr
from app.models.user import UserStatusEnum
from app.models.role import RoleEnum


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    roles: List[RoleEnum] = [RoleEnum.PATIENT]


class AdminUserStatusUpdate(BaseModel):
    status: UserStatusEnum


class FacilityCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None


class FacilityOut(BaseModel):
    id: int
    name: str
    address: Optional[str]
    phone: Optional[str]

    class Config:
        from_attributes = True


class SpecializationCreate(BaseModel):
    name: str


class SpecializationOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
