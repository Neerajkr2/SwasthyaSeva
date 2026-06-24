# backend/routes/ml.py
import uuid, logging, mimetypes, base64
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.user import UserVitals, MedicalReport
from schemas.schemas import (
    SymptomRequest, SymptomResult, SymptomSelectRequest,
    RiskRequest, RiskResult,
    DrugRequest, DrugResult,
    ReportAnalysisResult,
)
from services.auth_service import get_current_user_id
from services.claude_service import get_ai_response
from ml.registry import (
    get_disease_predictor, get_symptom_analyzer,
    get_drug_checker, get_nb_predictor,
)

logger   = logging.getLogger(__name__)
router   = APIRouter()
MAX_FILE = 10 * 1024 * 1024
ALLOWED  = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


# Models load lazily on first use (see ml/registry.py); these stay thin wrappers.
def _predictor(r):    return get_disease_predictor(r.app)
def _analyzer(r):     return get_symptom_analyzer(r.app)
def _checker(r):      return get_drug_checker(r.app)
def _nb(r):
    nb = get_nb_predictor(r.app)
    if nb is None:
        raise HTTPException(503, "NB Predictor is unavailable — model files may be missing.")
    return nb


# ── Helper: bridge NB output → SymptomResult ─────────────────────────────────
def _nb_to_symptom_result(raw: Dict[str, Any], selected: List[str]) -> Dict[str, Any]:
    """
    Convert the NBPredictor output dict into the SymptomResult schema format
    so the frontend can consume it identically to the text-based analysis.
    """
    from ml.symptom_analyzer import (
        _detect_urgency, _urgency_recommendation,
        _get_self_care, _get_follow_up_questions, _generate_recovery_plan,
        FOOD_GUIDANCE, DEFAULT_FOOD_GUIDANCE,
    )
    from ml.nb_predictor import get_body_system, get_specialist

    diseases = raw.get("diseases", [])
    matched  = raw.get("matched_symptoms", [])

    # Build conditions list ────────────────────────────────────────────────────
    conditions: List[Dict[str, Any]] = []
    for d in diseases[:6]:
        name  = d["name"]
        score = d["probability"]
        body  = get_body_system(name)
        conditions.append({"label": name, "score": round(score, 3), "body_system": body})

    # Derive urgency from matched symptom text ─────────────────────────────────
    symptom_text = " ".join(matched or selected)
    urgency      = _detect_urgency(symptom_text)

    # Build specialist list (deduplicated) ────────────────────────────────────
    seen_specs: set  = set()
    specialists: List[str] = []
    for c in conditions[:3]:
        spec = get_specialist(c["label"], c["body_system"])
        if spec not in seen_specs:
            seen_specs.add(spec)
            specialists.append(spec)
    if not specialists:
        specialists = ["General Physician"]

    body_systems = list(dict.fromkeys(c["body_system"] for c in conditions))

    # Food guidance — look up by body system directly (NB disease names differ
    # from symptom_analyzer's CONDITION_BODY_SYSTEM keys, so we skip that lookup)
    primary_system   = body_systems[0] if body_systems else ""
    food_guidance    = FOOD_GUIDANCE.get(primary_system, DEFAULT_FOOD_GUIDANCE)

    # Confidence signal — based on top score + number of symptoms selected
    top_score = conditions[0]["score"] if conditions else 0.0
    sig = top_score * 0.6 + min(len(matched or selected), 6) / 6 * 0.4
    if sig >= 0.6:
        conf = {"level": "high",   "score": round(sig, 3), "message": "Strong match from selected symptoms."}
    elif sig >= 0.38:
        conf = {"level": "medium", "score": round(sig, 3), "message": "Add a few more symptoms to sharpen the result."}
    else:
        conf = {"level": "low",    "score": round(sig, 3), "message": "Limited data. Select more symptoms for reliability."}

    return {
        "conditions":          conditions,
        "urgency":             urgency,
        "recommendation":      _urgency_recommendation(urgency),
        "body_systems":        body_systems,
        "self_care":           _get_self_care(conditions, urgency),
        "food_guidance":       food_guidance,
        "specialists":         specialists,
        "recovery_plan":       _generate_recovery_plan(conditions, urgency),
        "follow_up_questions": _get_follow_up_questions(symptom_text),
        "analysis_confidence": conf,
        "disclaimer": (
            "AI-generated analysis powered by clinical NB classifier. "
            "Does NOT constitute a medical diagnosis. Consult a licensed physician."
        ),
    }


# ── Existing text-based symptom endpoint ─────────────────────────────────────
@router.post("/symptoms", response_model=SymptomResult)
async def analyze_symptoms(body: SymptomRequest, request: Request,
                            user_id: str = Depends(get_current_user_id)):
    return SymptomResult(**_analyzer(request).analyze(body.symptoms))


# ── NEW: return the canonical 377-feature symptom list ───────────────────────
@router.get("/symptom-list")
async def get_symptom_list(request: Request,
                            user_id: str = Depends(get_current_user_id)):
    """Returns the full canonical clinical feature list (377 symptoms) for
    the interactive symptom selection panel in the frontend."""
    nb = _nb(request)
    return {"symptoms": nb.get_symptom_list(), "total": len(nb.get_symptom_list())}


# ── NEW: selection-based analysis via NB model ───────────────────────────────
@router.post("/symptoms/select", response_model=SymptomResult)
async def analyze_by_selection(
    body:    SymptomSelectRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    """
    Accepts a list of symptom strings (selected from the canonical clinical list),
    runs inference through the Multinomial Naive Bayes model, and returns a full
    SymptomResult (identical schema to the text-based /symptoms endpoint) so the
    frontend result view works unchanged.
    """
    nb  = _nb(request)
    raw = nb.predict(body.symptoms)

    if raw["type"] == "insufficient_data":
        # Return a well-formed but low-confidence result rather than a 422
        return SymptomResult(
            conditions=[],
            urgency="low",
            recommendation="Please add more symptoms for a more accurate analysis.",
            body_systems=[],
            self_care={
                "immediate": ["Add more specific symptoms and try again."],
                "otc_meds":  [],
                "warning_signs": ["Seek medical advice if symptoms are severe or worsening."],
            },
            food_guidance={},
            specialists=["General Physician"],
            recovery_plan={},
            follow_up_questions=[],
            disclaimer=(
                "Insufficient symptom data for confident prediction. "
                "Please select more symptoms or describe them in the chat."
            ),
        )

    mapped = _nb_to_symptom_result(raw, body.symptoms)
    return SymptomResult(**mapped)


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
