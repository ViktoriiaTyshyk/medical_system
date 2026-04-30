from fastapi import FastAPI
from fastapi.concurrency import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, users, cases, messages, files, patients, radiologists, family_doctors, admin, profiles
from app.api import ai_analysis
from app.core.config import settings
from app.db.base import Base
from sqlalchemy.ext.asyncio import create_async_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    _engine = create_async_engine(settings.DATABASE_URL)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _engine.dispose()
    yield


app = FastAPI(
    title="Medical Information System",
    description="Backend for patient-doctor-radiologist medical platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.get("/")
def root():
    return {"message": "Medical Information System API v1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
