from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel
from app.db.session import get_db
from app.core.dependencies import require_role
from app.models.role import Role, RoleEnum
from app.models.user_role import UserRole
from app.models.user import User
from app.models.case import Case, CaseStatusEnum, UrgencyEnum
from app.models.case_participant import CaseParticipant
from app.models.patient_profile import PatientProfile
from app.schemas.case import CaseOut
from datetime import datetime

router = APIRouter()

# ── Шаблони звітів ────────────────────────────────────────────────────────────

REPORT_TEMPLATES = {
    "normal": {
        "name": "Норма",
        "text": (
            "Рентгенографія органів грудної клітки без патологічних змін. "
            "Легеневі поля прозорі, судинний рисунок в нормі. "
            "Серцева тінь не розширена. Синуси вільні. "
            "Кісткова система без деструктивних змін. "
            "Висновок: Патологічних змін не виявлено. "
            "AI-скринінг підтверджено: результат відповідає нормі."
        ),
    },
    "atelectasis": {
        "name": "Ателектаз",
        "text": (
            "На рентгенограмі органів грудної клітки визначається ділянка зниженої пневматизації "
            "легеневої тканини, що відповідає ознакам ателектазу. "
            "Судинний рисунок у зоні ураження збіднений, можливе зміщення середостіння. "
            "Рекомендовано КТ органів грудної клітки для уточнення об'єму та причини ателектазу, "
            "консультація пульмонолога або торакального хірурга."
        ),
    },
    "cardiomegaly": {
        "name": "Кардіомегалія",
        "text": (
            "На рентгенограмі органів грудної клітки визначається розширення тіні серця, "
            "кардіоторакальний індекс перевищує норму. "
            "Ознаки характерні для кардіомегалії, що може бути обумовлена серцевою недостатністю, "
            "кардіоміопатією або іншою кардіальною патологією. "
            "Рекомендована консультація кардіолога, ЕКГ та ехокардіографія."
        ),
    },
    "effusion": {
        "name": "Плевральний випіт",
        "text": (
            "На рентгенограмі визначається затемнення нижніх відділів легеневого поля "
            "з характерною косою верхньою межею, що відповідає наявності рідини "
            "в плевральній порожнині. "
            "Рекомендована УЗД плевральних порожнин, консультація хірурга "
            "та вирішення питання про плевральну пункцію."
        ),
    },
    "pneumothorax": {
        "name": "Пневмоторакс",
        "text": (
            "На рентгенограмі визначається просвітлення в ділянці легеневого поля "
            "без легеневого рисунку, що відповідає наявності повітря в плевральній порожнині. "
            "Ознаки пневмотораксу. "
            "Потребує невідкладної консультації хірурга. "
            "При значному колапсі легені показано дренування плевральної порожнини."
        ),
    },
    "infiltration": {
        "name": "Інфільтрація",
        "text": (
            "На оглядовій рентгенограмі органів грудної клітки визначаються ділянки "
            "підвищеної інтенсивності тіні легеневої тканини (інфільтрація). "
            "Зміни можуть відповідати пневмонії, набряку або іншому запальному процесу. "
            "Рекомендована консультація пульмонолога та призначення відповідного лікування "
            "з контрольною рентгенограмою через 4–6 тижнів."
        ),
    },
    "mass_nodule": {
        "name": "Пухлина / вузол",
        "text": (
            "На рентгенограмі визначається округла або неправильної форми тінь "
            "у легеневому полі, що потребує диференційної діагностики між "
            "доброякісним та злоякісним процесом. "
            "Рекомендована КТ органів грудної клітки з контрастуванням, "
            "консультація онколога та рішення щодо морфологічної верифікації."
        ),
    },
    "deviation_unclassified": {
        "name": "Відхилення не класифіковано",
        "text": (
            "На рентгенограмі визначаються зміни, що відхиляються від норми, "
            "однак не дозволяють встановити конкретну нозологічну форму "
            "в рамках наявних класів AI-моделі. "
            "Рекомендовано проведення КТ органів грудної клітки "
            "та консультація профільного спеціаліста для уточнення діагнозу."
        ),
    },
}


class ReportSubmit(BaseModel):
    template_key: Optional[str] = None
    custom_text: Optional[str] = None


# ── Ендпоїнти ─────────────────────────────────────────────────────────────────

@router.patch("/availability")
async def set_availability(
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RADIOLOGIST)),
):
    """Рентгенолог встановлює свій статус доступності."""
    from app.models.radiologist_profile import AvailabilityStatusEnum, RadiologistProfile
    allowed = {e.value for e in AvailabilityStatusEnum}
    if status not in allowed:
        raise HTTPException(400, f"Статус має бути одним з: {', '.join(allowed)}")
    res = await db.execute(
        select(RadiologistProfile).where(RadiologistProfile.user_id == current_user.id)
    )
    profile = res.scalar_one_or_none()
    if not profile:
        profile = RadiologistProfile(user_id=current_user.id)
        db.add(profile)
    profile.availability_status = status
    await db.commit()
    return {"availability_status": status}


@router.get("/my-cases", response_model=List[CaseOut])
async def get_my_cases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RADIOLOGIST)),
):
    result = await db.execute(
        select(Case)
        .join(CaseParticipant, CaseParticipant.case_id == Case.id)
        .where(CaseParticipant.user_id == current_user.id)
    )
    return result.scalars().all()


@router.get("/my-cases/{case_id}", response_model=CaseOut)
async def get_my_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RADIOLOGIST)),
):
    result = await db.execute(
        select(Case)
        .join(CaseParticipant, CaseParticipant.case_id == Case.id)
        .where(Case.id == case_id, CaseParticipant.user_id == current_user.id)
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.get("/report-templates")
async def get_report_templates(
    current_user: User = Depends(require_role(RoleEnum.RADIOLOGIST, RoleEnum.ADMIN)),
):
    """Список доступних шаблонів звітів."""
    return [
        {"key": k, "name": v["name"], "preview": v["text"][:120] + "..."}
        for k, v in REPORT_TEMPLATES.items()
    ]


@router.post("/my-cases/{case_id}/report")
async def submit_report(
    case_id: int,
    data: ReportSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RADIOLOGIST, RoleEnum.ADMIN)),
):
    """
    Рентгенолог або адмін формує висновок і за потреби призначає терапевта.
    """
    user_roles = {r.name for r in current_user.roles}
    is_admin = RoleEnum.ADMIN.value in user_roles
    if is_admin:
        q = select(Case).where(Case.id == case_id)
    else:
        q = (
            select(Case)
            .join(CaseParticipant, CaseParticipant.case_id == Case.id)
            .where(Case.id == case_id, CaseParticipant.user_id == current_user.id)
        )
    res = await db.execute(q)
    case = res.scalar_one_or_none()
    if not case:
        raise HTTPException(404, "Кейс не знайдено або у вас немає доступу")
    parts = []
    if data.template_key:
        tmpl = REPORT_TEMPLATES.get(data.template_key)
        if not tmpl:
            raise HTTPException(400, f"Шаблон '{data.template_key}' не існує")
        parts.append(tmpl["text"])
    if data.custom_text and data.custom_text.strip():
        parts.append(data.custom_text.strip())
    if not parts:
        raise HTTPException(400, "Вкажіть template_key або custom_text")

    rad_name = f"{current_user.first_name} {current_user.last_name}"
    timestamp = datetime.utcnow().strftime("%d.%m.%Y %H:%M")

    case.conclusion = (
        f"[Висновок рентгенолога {rad_name}, {timestamp} UTC]\n\n"
        + "\n\n".join(parts)
    )

    # Urgency за словом лікаря: рентгенолог завжди пріоритетніший за AI
    if data.template_key == "normal":
        case.urgency = UrgencyEnum.NORMAL          # лікар підтвердив норму
    elif data.template_key and data.template_key != "deviation_unclassified":
        case.urgency = UrgencyEnum.URGENT           # лікар підтвердив конкретну патологію
    # deviation_unclassified або custom_text → не змінюємо urgency (лишається як AI встановив)

    # Автоматично призначити терапевта з профілю пацієнта
    therapist = None
    profile_res = await db.execute(
        select(PatientProfile).where(PatientProfile.user_id == case.patient_id)
    )
    profile = profile_res.scalar_one_or_none()
    if profile and profile.family_doctor_id:
        t_res = await db.execute(select(User).where(User.id == profile.family_doctor_id))
        therapist = t_res.scalar_one_or_none()

    if therapist:
        existing = await db.execute(
            select(CaseParticipant).where(
                CaseParticipant.case_id == case_id,
                CaseParticipant.user_id == therapist.id,
            )
        )
        if not existing.scalar_one_or_none():
            db.add(CaseParticipant(case_id=case_id, user_id=therapist.id))
        case.therapist_id = therapist.id
        case.status = CaseStatusEnum.IN_PROGRESS
    else:
        case.status = CaseStatusEnum.COMPLETED
        case.closed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(case)

    return {
        "case_id": case.id,
        "status": case.status,
        "conclusion_preview": case.conclusion[:200],
        "message": (
            f"Висновок збережено. Терапевту {therapist.first_name} {therapist.last_name} автоматично надано доступ до справи."
            if therapist else "Висновок збережено. Справу завершено."
        ),
    }


@router.get("/my-patients")
async def get_my_patients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RADIOLOGIST)),
):
    """Унікальні пацієнти з усіх кейсів рентгенолога."""
    res = await db.execute(
        select(Case)
        .join(CaseParticipant, CaseParticipant.case_id == Case.id)
        .where(CaseParticipant.user_id == current_user.id)
        .options(selectinload(Case.patient))
    )
    cases = res.scalars().all()
    seen = set()
    patients = []
    for c in cases:
        if c.patient_id not in seen:
            seen.add(c.patient_id)
            patients.append({
                "id": c.patient.id,
                "first_name": c.patient.first_name,
                "last_name": c.patient.last_name,
                "email": c.patient.email,
            })
    return patients
