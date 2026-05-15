# backend/routes/ml.py
import uuid, logging, mimetypes, base64
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.user import UserVitals, MedicalReport
from schemas.schemas import (
    SymptomRequest, SymptomResult,
    RiskRequest, RiskResult,
    DrugRequest, DrugResult,
    ReportAnalysisResult,
)
from services.auth_service import get_current_user_id
from services.claude_service import get_ai_response

logger   = logging.getLogger(__name__)
router   = APIRouter()
MAX_FILE = 10 * 1024 * 1024
ALLOWED  = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


def _predictor(r):    return r.app.state.disease_predictor
def _analyzer(r):     return r.app.state.symptom_analyzer
def _checker(r):      return r.app.state.drug_checker


@router.post("/symptoms", response_model=SymptomResult)
async def analyze_symptoms(body: SymptomRequest, request: Request,
                            user_id: str = Depends(get_current_user_id)):
    return SymptomResult(**_analyzer(request).analyze(body.symptoms))


@router.post("/risk", response_model=RiskResult)
async def predict_risk(body: RiskRequest, request: Request,
                       user_id: str = Depends(get_current_user_id),
                       db: AsyncSession = Depends(get_db)):
    params = body.model_dump()
    res = await db.execute(select(UserVitals).where(UserVitals.user_id == user_id))
    v   = res.scalar_one_or_none()
    if v:
        if not params.get("age")    and v.age:    params["age"]    = v.age
        if not params.get("weight") and v.weight:  params["weight"] = v.weight
        if not params.get("height") and v.height:  params["height"] = v.height
        if not params.get("blood_pressure") and v.blood_pressure:
            params["blood_pressure"] = v.blood_pressure
    return RiskResult(**_predictor(request).predict(params))


@router.post("/drugs", response_model=DrugResult)
async def check_drugs(body: DrugRequest, request: Request,
                      user_id: str = Depends(get_current_user_id)):
    if len(body.drugs) < 2:
        raise HTTPException(400, "Provide at least 2 drug names.")
    result = _checker(request).check_comprehensive(body.drugs)
    return DrugResult(**result)


@router.post("/report", response_model=ReportAnalysisResult)
async def analyze_report(
    file:    UploadFile   = File(...),
    user_id: str          = Depends(get_current_user_id),
    db:      AsyncSession = Depends(get_db),
):
    from ml.report_analyzer import ReportAnalyzer
    from services.claude_service import build_report_messages

    media_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if media_type not in ALLOWED:
        raise HTTPException(415, f"Unsupported type: {media_type}. Upload PDF, JPG, PNG or WebP.")

    raw = await file.read()
    if len(raw) > MAX_FILE:
        raise HTTPException(413, "File too large. Max 10 MB.")

    filename = file.filename or "report"

    # ── Stage 1-3: OCR + parse + condition detection + medicine detection ──
    parsed = ReportAnalyzer.analyze(raw, media_type)

    # ── Build a comprehensive prompt for Claude ──
    abnormal_txt = "\n".join(
        f"  - {v['parameter']}: {v['value']} {v['unit']} ({v.get('flag', '')})"
        for v in parsed["abnormal_values"]
    ) or "None detected"

    conditions_txt = "\n".join(
        f"  - {c['name']} (confidence: {c['confidence']:.0%}, severity: {c['severity']})"
        for c in parsed["conditions"]
    ) or "None detected"

    medicines_txt = "\n".join(
        f"  - {m['name']} {m['dosage']} ({m.get('purpose', 'unknown purpose')})"
        for m in parsed["medicines"]
    ) or "None detected"

    prompt = (
        f"Medical report: '{filename}' (type: {parsed['report_type']})\n"
        f"Health Score: {parsed['health_score']}/100\n\n"
        f"OCR text (first 2000 chars):\n```\n{parsed['extracted_text'][:2000]}\n```\n\n"
        f"Abnormal values:\n{abnormal_txt}\n\n"
        f"Detected conditions:\n{conditions_txt}\n\n"
        f"Detected medicines:\n{medicines_txt}\n\n"
        "You MUST respond with ONLY a valid JSON object (no markdown, no code fences). Use this exact structure:\n"
        "{\n"
        '  "interpretation": "A clear, patient-friendly explanation of each finding (2-3 paragraphs). Use simple language.",\n'
        '  "diet_plan": {\n'
        '    "foods_to_eat": ["list of 6-8 recommended foods with brief reasons"],\n'
        '    "foods_to_avoid": ["list of 5-6 foods to avoid with brief reasons"],\n'
        '    "sample_meal": "A one-day sample meal plan: breakfast, lunch, dinner, snacks"\n'
        "  },\n"
        '  "exercise_plan": {\n'
        '    "type": "recommended exercise type",\n'
        '    "duration": "recommended daily duration",\n'
        '    "frequency": "days per week",\n'
        '    "precautions": "any exercise precautions",\n'
        '    "activities": ["list of 4-5 specific activities"]\n'
        "  },\n"
        '  "recovery_roadmap": {\n'
        '    "week_1": {"goals": ["list"], "actions": ["list"]},\n'
        '    "month_1": {"goals": ["list"], "actions": ["list"]},\n'
        '    "month_6": {"goals": ["list"], "actions": ["list"]},\n'
        '    "year_1": {"goals": ["list"], "actions": ["list"]}\n'
        "  },\n"
        '  "follow_up": {\n'
        '    "specialists": ["list of specialist types to consult"],\n'
        '    "tests": ["list of follow-up tests recommended"],\n'
        '    "timeline": "when to schedule next checkup"\n'
        "  }\n"
        "}\n"
    )

    ai_text = ""
    diet_plan = {}
    exercise_plan = {}
    recovery_roadmap = {}
    follow_up = {}

    try:
        messages = build_report_messages(raw, media_type, filename, prompt)
        ai_raw = await get_ai_response(messages, max_tokens=2500)

        # Parse Claude's JSON response
        import json
        try:
            # Strip markdown code fences if present
            cleaned = ai_raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()

            ai_data = json.loads(cleaned)
            ai_text = ai_data.get("interpretation", "")
            diet_plan = ai_data.get("diet_plan", {})
            exercise_plan = ai_data.get("exercise_plan", {})
            recovery_roadmap = ai_data.get("recovery_roadmap", {})
            follow_up = ai_data.get("follow_up", {})
        except json.JSONDecodeError:
            # If JSON parsing fails, use raw text as interpretation
            ai_text = ai_raw
            logger.warning("Claude response was not valid JSON, using raw text")

    except Exception as exc:
        logger.warning(f"Claude unavailable for report: {exc}")
        if parsed["lab_values"]:
            lines = [f"- {v['parameter']}: {v['value']} {v['unit']} ({v.get('flag', '')})"
                     for v in parsed["lab_values"][:15]]
            flagged = [f"- {v['parameter']} is {v['status'].upper()}"
                       for v in parsed["abnormal_values"]]
            ai_text = (
                "**Offline Analysis (local OCR)**\n\n"
                "Extracted values:\n" + "\n".join(lines)
                + ("\n\nFlagged:\n" + "\n".join(flagged) if flagged else "\n\nAll values appear normal.")
                + "\n\n*Full AI interpretation unavailable. Please consult your healthcare provider.*"
            )
        else:
            ai_text = "OCR extracted limited text. Ensure the document is clear and retry."

    # ── Save to DB ──
    b64      = base64.standard_b64encode(raw).decode()
    data_url = f"data:{media_type};base64,{b64}"

    report = MedicalReport(
        id             = str(uuid.uuid4()),
        user_id        = user_id,
        original_name  = filename,
        file_type      = media_type,
        extracted_text = (parsed["extracted_text"] or "")[:5000],
        ai_analysis    = (ai_text or "")[:5000],
        file_data      = data_url,
    )
    db.add(report)
    await db.flush()
    logger.info(f"Saved report '{filename}' for user {user_id}")

    return ReportAnalysisResult(
        extracted_text    = parsed["extracted_text"],
        report_type       = parsed["report_type"],
        health_score      = parsed["health_score"],
        lab_values        = parsed["lab_values"],
        abnormal_values   = parsed["abnormal_values"],
        conditions        = parsed["conditions"],
        medicines         = parsed["medicines"],
        categories        = parsed["categories"],
        ai_interpretation = ai_text,
        diet_plan         = diet_plan,
        exercise_plan     = exercise_plan,
        recovery_roadmap  = recovery_roadmap,
        follow_up         = follow_up,
        disclaimer        = (
            "This is an AI-generated analysis based on OCR and statistical models. "
            "It is NOT a medical diagnosis. Always consult a licensed physician."
        ),
    )
