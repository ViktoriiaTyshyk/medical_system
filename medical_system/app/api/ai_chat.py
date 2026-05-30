from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Literal
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.role import RoleEnum
from app.models.case import Case, UrgencyEnum
from app.models.case_participant import CaseParticipant
from app.models.patient_profile import PatientProfile
from app.core.config import settings

router = APIRouter()

MULTICLASS_LABELS = {
    "Atelectasis":  "Ателектаз",
    "Cardiomegaly": "Кардіомегалія",
    "Effusion":     "Плевральний випіт",
    "Pneumothorax": "Пневмоторакс",
    "Infiltration": "Інфільтрація",
    "Mass/Nodule":  "Пухлина / вузол",
    "Other":        "Інші / невизначено",
}


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AiChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


@router.post("/cases/{case_id}/ai-chat")
async def ai_chat(
    case_id: int,
    data: AiChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI-асистент для лікарів — відповідає на запитання в контексті кейсу."""
    user_roles = {r.name for r in current_user.roles}
    is_admin   = RoleEnum.ADMIN.value in user_roles
    is_patient = RoleEnum.PATIENT.value in user_roles

    case_res = await db.execute(select(Case).where(Case.id == case_id))
    case = case_res.scalar_one_or_none()
    if not case:
        raise HTTPException(404, "Справу не знайдено")

    # Перевірка доступу
    if not is_admin:
        if is_patient:
            # Пацієнт може писати лише у свою справу
            if case.patient_id != current_user.id:
                raise HTTPException(403, "Це не ваша справа")
        else:
            # Лікар — учасник справи або терапевт пацієнта
            part_res = await db.execute(
                select(CaseParticipant).where(
                    CaseParticipant.case_id == case_id,
                    CaseParticipant.user_id == current_user.id,
                )
            )
            has_access = part_res.scalar_one_or_none() is not None

            if not has_access and RoleEnum.FAMILY_DOCTOR.value in user_roles:
                prof_res = await db.execute(
                    select(PatientProfile).where(
                        PatientProfile.user_id == case.patient_id,
                        PatientProfile.family_doctor_id == current_user.id,
                    )
                )
                has_access = prof_res.scalar_one_or_none() is not None

            if not has_access:
                raise HTTPException(403, "Ви не є учасником цієї справи")

    # Будуємо контекст кейсу
    ai = case.ai_result or {}
    stage = ai.get("stage", "")
    is_urgent = case.urgency == UrgencyEnum.URGENT
    urgency_text = "ТЕРМІНОВО" if is_urgent else "НОРМА"

    if stage == "healthy":
        norm_pct = round((1 - ai.get("binary_prob", 0)) * 100, 1)
        ai_summary = f"Патологій не виявлено (норма {norm_pct}%)"
    elif stage == "classified":
        top_label = MULTICLASS_LABELS.get(ai.get("top_class", ""), ai.get("top_class", ""))
        top_prob = round(ai.get("top_prob", 0) * 100, 1)
        ai_summary = f"Виявлено: {top_label} ({top_prob}%)"
    elif stage == "unclassifiable":
        abn_pct = round(ai.get("binary_prob", 0) * 100, 1)
        ai_summary = f"Відхилення від норми ({abn_pct}%), патологія не класифікована"
    else:
        ai_summary = "AI-аналіз не проводився"

    if is_patient:
        system_prompt = f"""Ти медичний AI-асистент у системі аналізу рентгенівських знімків легень.
Спілкуєшся з пацієнтом. Пояснюй результати простою мовою без зайвого медичного жаргону.
Відповідай виключно українською мовою. Будь доброзичливим і заспокійливим.
Не ставиш діагнозів — радиш звернутись до лікаря для остаточного висновку.

Інформація про справу пацієнта #{case.id}:
- Назва: {case.title}
- Ургентність: {urgency_text}
- Результат AI-скринінгу: {ai_summary}
- Висновок рентгенолога: {case.conclusion or "Ще не надано"}
- Призначення: {case.therapist_note or "Ще не надано"}

Допомагаєш пацієнту зрозуміти що відбувається і що робити далі."""
    else:
        system_prompt = f"""Ти медичний AI-асистент у системі аналізу рентгенівських знімків легень.
Допомагаєш лікарям (рентгенологам та терапевтам) інтерпретувати результати скринінгу, \
формулювати висновки та відповідаєш на клінічні запитання.
Відповідай виключно українською мовою. Будь точним і лаконічним.

Контекст справи #{case.id}:
- Назва: {case.title}
- Ургентність: {urgency_text}
- Результат AI-скринінгу: {ai_summary}
- Висновок рентгенолога: {case.conclusion or "Ще не надано"}
- Призначення терапевта: {case.therapist_note or "Ще не надано"}

Ти не ставиш остаточних діагнозів. Допомагаєш лікарям розібратись і приймати рішення."""

    if not settings.GROQ_API_KEY:
        raise HTTPException(500, "GROQ_API_KEY не налаштовано в docker-compose.yml")

    messages = [{"role": "system", "content": system_prompt}]
    for m in data.history:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": data.message})

    try:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "max_tokens": 1024,
                    "messages": messages,
                },
            )
            resp.raise_for_status()
            return {"reply": resp.json()["choices"][0]["message"]["content"]}

    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Groq API помилка: {e.response.text}")
    except Exception as e:
        raise HTTPException(500, f"Помилка AI-асистента: {str(e)}")
