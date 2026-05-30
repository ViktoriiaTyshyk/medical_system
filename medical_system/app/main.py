from fastapi import FastAPI
from fastapi.concurrency import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, users, cases, messages, files, patients, radiologists, family_doctors, admin, profiles
from app.api import ai_analysis, ai_chat, reviews
from app.models import radiologist_review  # noqa: F401 — ensure table is created
from app.models import password_reset_token  # noqa: F401 — ensure table is created
from app.core.config import settings
from app.db.base import Base
from sqlalchemy.ext.asyncio import create_async_engine


async def _seed_admin(engine) -> None:
    """Створює адміністратора при першому запуску якщо його немає."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select
    from app.models.user import User
    from app.models.role import Role, RoleEnum
    from app.models.user_role import UserRole
    from app.core.security import get_password_hash

    async with AsyncSession(engine) as db:
        exists = await db.execute(select(User).where(User.email == "admin@med.com"))
        if exists.scalar_one_or_none():
            return

        role_res = await db.execute(select(Role).where(Role.name == RoleEnum.ADMIN))
        role = role_res.scalar_one_or_none()
        if not role:
            role = Role(name=RoleEnum.ADMIN)
            db.add(role)
            await db.flush()

        admin_user = User(
            email="admin@med.com",
            password_hash=get_password_hash("123456"),
            first_name="Адмін",
            last_name="Системи",
        )
        db.add(admin_user)
        await db.flush()
        db.add(UserRole(user_id=admin_user.id, role_id=role.id))
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _engine = create_async_engine(settings.DATABASE_URL)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_admin(_engine)
    await _engine.dispose()
    yield


app = FastAPI(
    title="Medical Information System",
    description="Backend for patient-doctor-radiologist medical platform",
    version="1.0.0",
    lifespan=lifespan,
)

import os

_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
_origins = [o.strip() for o in _raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(profiles.router, prefix="/profiles", tags=["Profiles"])
app.include_router(cases.router, prefix="/cases", tags=["Cases"])
app.include_router(messages.router, prefix="", tags=["Messages"])
app.include_router(files.router, prefix="/files", tags=["Files"])
app.include_router(patients.router, prefix="/patients", tags=["Patients"])
app.include_router(radiologists.router, prefix="/radiologists", tags=["Radiologists"])
app.include_router(family_doctors.router, prefix="/family-doctors", tags=["FamilyDoctors"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(ai_analysis.router, prefix="/ai", tags=["AI Analysis"])
app.include_router(ai_chat.router, prefix="", tags=["AI Chat"])
app.include_router(reviews.router, prefix="", tags=["Reviews"])


@app.get("/")
def root():
    return {"message": "Medical Information System API v1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
