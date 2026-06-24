# backend/routes/chat.py
"""
Chat routes for SwasthyaSeva AI.

Flow for /chat/message (the only AI-powered endpoint here):

    Incoming user text/file
        ↓
    Build chat history (last 20 msgs)
        ↓
    RAG retrieval — top-k healthcare articles relevant to the question
        ↓
    Inject retrieved context into Claude's system prompt
        ↓
    Claude generates a knowledge-based educational response
        ↓
    If the user described personal symptoms → Claude redirects to Symptom Analyzer
        (handled by the system-prompt rule; no Python branching needed)
        ↓
    If the Claude API is unavailable → local fallback responds with
    drug-interaction info OR a curated knowledge snippet OR the symptom
    redirect message — but NEVER runs the symptom analyzer here, since
    that's the dedicated /symptoms endpoint's job.
"""
import logging
import mimetypes
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.user import ChatMessage, ChatSession, MedicalReport, User, UserVitals  # noqa: F401 (UserVitals re-exported)
from schemas.schemas import MessageOut, SessionDetailOut, SessionOut
from services.auth_service import get_current_user_id
from services.claude_service import (
    DEFAULT_MODEL,  # noqa: F401
    SYMPTOM_REDIRECT_MESSAGE,
    build_chat_messages,
    build_user_context,
    get_ai_response,
)
from services.rag_service import is_personal_symptom_query
from ml.registry import get_drug_checker, get_knowledge_retriever

logger = logging.getLogger(__name__)
router = APIRouter()
MAX_FILE = 10 * 1024 * 1024
ALLOWED = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"}


# ════════════════════════════════════════════════════════════════════════════
#  GET /chat/sessions
# ════════════════════════════════════════════════════════════════════════════
@router.get("/sessions", response_model=list[SessionOut])
async def get_sessions(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    msg_sq = (
        select(ChatMessage.session_id, func.count(ChatMessage.id).label("cnt"))
        .group_by(ChatMessage.session_id).subquery()
    )
    rows = await db.execute(
        select(ChatSession, msg_sq.c.cnt)
        .outerjoin(msg_sq, ChatSession.id == msg_sq.c.session_id)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
    )
    result = []
    for sess, cnt in rows.all():
        out = SessionOut.model_validate(sess)
        out.message_count = cnt or 0
        result.append(out)
    return result


# ════════════════════════════════════════════════════════════════════════════
#  POST /chat/sessions
# ════════════════════════════════════════════════════════════════════════════
@router.post("/sessions", response_model=SessionOut, status_code=201)
async def create_session(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    sess = ChatSession(id=str(uuid.uuid4()), user_id=user_id)
    db.add(sess)
    await db.flush()
    await db.refresh(sess)
    return SessionOut(id=sess.id, title=sess.title, created_at=sess.created_at, message_count=0)


# ════════════════════════════════════════════════════════════════════════════
#  GET /chat/sessions/{id}
# ════════════════════════════════════════════════════════════════════════════
@router.get("/sessions/{session_id}", response_model=SessionDetailOut)
async def get_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    sess = res.scalar_one_or_none()
    if not sess:
        raise HTTPException(404, "Session not found")
    return SessionDetailOut(
        id=sess.id,
        title=sess.title,
        created_at=sess.created_at,
        message_count=len(sess.messages),
        messages=[MessageOut.model_validate(m) for m in sess.messages],
    )


# ════════════════════════════════════════════════════════════════════════════
#  DELETE /chat/sessions/{id}
# ════════════════════════════════════════════════════════════════════════════
@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    sess = res.scalar_one_or_none()
    if not sess:
        raise HTTPException(404, "Session not found")
    await db.delete(sess)


# ════════════════════════════════════════════════════════════════════════════
#  LOCAL FALLBACK
#  Used only when the Claude API is unavailable (e.g. credit exhausted).
#
#  This used to run the Symptom Analyzer for general chat input — that
#  duplicated the dedicated /ml/symptoms endpoint's job. The new behavior:
#
#    1. If the user is asking about drug interactions  → run drug checker.
#    2. If the user is describing personal symptoms     → redirect to the
#       Symptom Analyzer (do NOT run analysis here).
#    3. Otherwise                                       → return the
#       most-relevant knowledge-base article(s) using the RAG retriever.
# ════════════════════════════════════════════════════════════════════════════

_DRUG_KEYWORDS = {
    "drug", "medicine", "medication", "tablet", "pill", "interact",
    "interaction", "interactions",
    "metformin", "aspirin", "ibuprofen", "warfarin", "amlodipine",
    "atorvastatin", "paracetamol", "amoxicillin", "ciprofloxacin",
    "lisinopril", "sertraline", "tramadol", "diazepam", "omeprazole",
}

_KNOWN_DRUGS = [
    "metformin", "aspirin", "ibuprofen", "warfarin", "amlodipine",
    "atorvastatin", "paracetamol", "amoxicillin", "ciprofloxacin",
    "lisinopril", "sertraline", "tramadol", "diazepam", "omeprazole",
]


def _local_health_response(message: str, request: Request) -> str:
    """
    Generate a structured response WITHOUT calling Claude.

    Keeps SwasthyaSeva AI useful even when the API is unreachable, while
    respecting the new architecture (no symptom analysis here).
    """
    msg_lower = (message or "").lower()
    parts: list[str] = []

    try:
        drug_checker = get_drug_checker(request.app)
    except Exception:               # keep the fallback alive even if the model can't load
        drug_checker = None
    retriever = get_knowledge_retriever(request.app)

    # ── (1) Drug-interaction query ─────────────────────────────────────────
    is_drug_query = any(k in msg_lower for k in _DRUG_KEYWORDS)
    if is_drug_query and drug_checker:
        found = [d for d in _KNOWN_DRUGS if d in msg_lower]
        capitalised = re.findall(r"\b[A-Z][a-z]{3,}\b", message or "")
        all_drugs = list(dict.fromkeys(found + [c.lower() for c in capitalised]))

        if len(all_drugs) >= 2:
            result = drug_checker.check(all_drugs[:5])
            if result["interactions"]:
                lines = []
                for ix in result["interactions"]:
                    lines.append(
                        f"🔸 **{ix['drug1'].title()} + {ix['drug2'].title()}**\n"
                        f"   Severity: **{ix['severity'].title()}**\n"
                        f"   {ix['description']}\n"
                        f"   💡 Action: {ix['action']}"
                    )
                parts.append(
                    "💊 **Drug Interaction Information**\n\n"
                    + "\n\n".join(lines)
                    + f"\n\n**Summary:** {result['summary']}"
                )
            else:
                parts.append(
                    f"✅ **No significant interactions detected** between "
                    f"{', '.join(all_drugs)}.\n\n{result['summary']}"
                )
        else:
            parts.append(
                "💊 To check drug interactions, please mention at least two "
                "medication names. For richer interaction analysis, the dedicated "
                "**Drug Interaction Checker** tool is available in the sidebar."
            )

    # ── (2) Personal symptom description → redirect, don't analyze ────────
    elif is_personal_symptom_query(message or ""):
        parts.append(SYMPTOM_REDIRECT_MESSAGE)

    # ── (3) General knowledge question → RAG retrieval ─────────────────────
    elif retriever and message and len(message.strip()) >= 4:
        articles = retriever.retrieve(message, k=2)
        if articles:
            parts.append("📚 **Healthcare Knowledge**\n")
            for art in articles:
                parts.append(f"### {art['title']}  _( {art['category']} )_\n")
                parts.append(art["content"])
                parts.append("")
        else:
            parts.append(
                "🩺 **SwasthyaSeva Healthcare Knowledge Assistant**\n\n"
                "I can help you understand:\n"
                "• Diseases and conditions (e.g., diabetes, hypertension, asthma)\n"
                "• Medications and how they work\n"
                "• Preventive healthcare and screenings\n"
                "• Nutrition and wellness\n"
                "• First-aid and emergency awareness\n"
                "• Medical procedures\n\n"
                "Try asking, for example: *'What is hypertension?'*, *'How do statins work?'*, "
                "or *'What's in a healthy diet?'*"
            )

    # ── (4) Final empty fallback ───────────────────────────────────────────
    else:
        parts.append(
            "🩺 **SwasthyaSeva Healthcare Knowledge Assistant**\n\n"
            "Ask me anything about diseases, medications, prevention, nutrition, "
            "first aid, or medical procedures. For personal symptom analysis, "
            "please use the dedicated **Symptom Checker** tool from the sidebar."
        )

    response = "\n".join(parts)
    response += (
        "\n\n---\n*⚠️ The full AI assistant is temporarily unavailable, so this "
        "response was generated locally. Always consult a licensed healthcare "
        "professional for personal medical advice and treatment.*"
    )
    return response


# ════════════════════════════════════════════════════════════════════════════
#  POST /chat/message
# ════════════════════════════════════════════════════════════════════════════
@router.post("/message")
async def send_message(
    request: Request,
    session_id: str = Form(...),
    message: str = Form(""),
    file: Optional[UploadFile] = File(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # 1. Verify session ownership + load history
    res = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    sess = res.scalar_one_or_none()
    if not sess:
        raise HTTPException(404, "Session not found")

    # 2. Load user + vitals (for personalising tone, not for diagnosis)
    user_res = await db.execute(
        select(User).options(selectinload(User.vitals)).where(User.id == user_id)
    )
    user_obj = user_res.scalar_one_or_none()
    user_context = ""
    if user_obj:
        user_context = f"Patient Name: {user_obj.name}\n" + build_user_context(user_obj.vitals)

    # 3. Process optional file
    file_bytes, file_mtype, file_name, file_record = None, None, None, None
    if file and file.filename:
        raw = await file.read()
        if len(raw) > MAX_FILE:
            raise HTTPException(413, "File too large. Maximum 10 MB.")
        mt = file.content_type or mimetypes.guess_type(file.filename)[0] or ""
        if mt not in ALLOWED:
            raise HTTPException(415, f"Unsupported file type: {mt}")
        file_bytes, file_mtype, file_name = raw, mt, file.filename
        file_record = MedicalReport(
            id=str(uuid.uuid4()),
            user_id=user_id,
            original_name=file_name,
            file_type=file_mtype,
        )
        db.add(file_record)

    # 4. Build Claude messages
    history = [{"role": m.role, "content": m.content} for m in sess.messages[-20:]]
    claude_msgs = build_chat_messages(
        history=history,
        text=message,
        file_bytes=file_bytes,
        media_type=file_mtype,
        filename=file_name,
    )

    # 5. RAG retrieval — pull relevant healthcare articles for grounding
    knowledge_context = ""
    retriever = get_knowledge_retriever(request.app)
    if retriever and message and message.strip():
        try:
            articles = retriever.retrieve(message, k=3)
            if articles:
                knowledge_context = retriever.format_context(articles)
                logger.info(
                    "RAG retrieved %d articles for chat %s (top score=%.3f)",
                    len(articles),
                    session_id,
                    articles[0]["relevance_score"],
                )
        except Exception:
            logger.exception("RAG retrieval failed; continuing without context")

    # 6. Get AI reply — with smart local fallback
    ai_reply: str | None = None
    used_fallback = False

    try:
        ai_reply = await get_ai_response(
            claude_msgs,
            user_context=user_context,
            knowledge_context=knowledge_context,
        )
    except Exception as exc:
        exc_str = str(exc).lower()
        logger.warning(f"Claude API error: {exc}")

        if "credit balance" in exc_str or "insufficient" in exc_str or "billing" in exc_str:
            used_fallback = True
            ai_reply = _local_health_response(message or f"Analyse: {file_name}", request)
            if file_name:
                ai_reply = (
                    f"📄 **File received:** {file_name}\n\n"
                    "The full AI report analysis is unavailable because the "
                    "Anthropic API credits need to be replenished. The file "
                    "has been saved to your reports.\n\n" + ai_reply
                )
        else:
            ai_reply = (
                "⚠️ I'm temporarily unable to process your request. "
                "Please try again in a few seconds. "
                "For urgent health concerns, contact a healthcare professional directly."
            )

    # 7. Persist user message
    user_display = message or (f"[Uploaded: {file_name}]" if file_name else "")
    user_msg = ChatMessage(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="user",
        content=user_display,
        file_name=file_name,
        file_type=file_mtype,
    )
    db.add(user_msg)

    # 8. Persist AI reply
    bot_msg = ChatMessage(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="assistant",
        content=ai_reply,
    )
    db.add(bot_msg)

    # 9. Update session title on first message
    if not sess.messages and message.strip():
        sess.title = message.strip()[:60]

    # 10. Attach analysis to report if present
    if file_record:
        file_record.ai_analysis = ai_reply[:3000]

    await db.flush()
    await db.refresh(bot_msg)
    return {"reply": MessageOut.model_validate(bot_msg), "session_id": session_id}
