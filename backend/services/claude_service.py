# backend/services/claude_service.py
"""
Anthropic Claude integration for SwasthyaSeva AI.

CHANGED: previously SwasthyaSeva AI was framed as a symptom-analysis assistant,
which duplicated the dedicated /symptoms (Symptom Analyzer) feature.

Now SwasthyaSeva AI is a HEALTHCARE KNOWLEDGE assistant:
  • Answers educational/informational questions about diseases, medications,
    nutrition, prevention, first aid, procedures, and wellness.
  • Does NOT analyze a user's personal symptoms — when one is described,
    it warmly redirects to the Symptom Analyzer feature.

This module also now supports RAG: retrieved knowledge from
HealthcareKnowledgeRetriever can be injected into Claude's system prompt as
grounding context, identical in spirit to the LangChain RetrievalQA "stuff"
chain pattern in the reference repo.
"""
from __future__ import annotations

import base64
import logging

import anthropic

from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# ── Use claude-sonnet-4-6 — supports vision + documents + is faster ───────────
DEFAULT_MODEL = "claude-sonnet-4-6"

_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


# ════════════════════════════════════════════════════════════════════════════
#  SYSTEM PROMPT — Healthcare Knowledge Assistant (NOT a symptom checker)
# ════════════════════════════════════════════════════════════════════════════

HEALTHCARE_KNOWLEDGE_PROMPT = """You are SwasthyaSeva AI — a medically-informed healthcare KNOWLEDGE and EDUCATION assistant.

══════════════════════════════════════════════════════════════════
  YOUR ROLE
══════════════════════════════════════════════════════════════════
You answer evidence-based questions on:
• General healthcare knowledge and medical terminology
• Diseases and conditions — causes, mechanisms, stages, complications, prognosis
• Medications and treatments (informational) — how they work, drug classes, side effects, safe use
• Preventive healthcare — screenings, vaccines, risk reduction
• Nutrition and wellness — diets, vitamins, hydration, lifestyle
• First-aid education and emergency awareness
• Medical procedures and what to expect from them
• Women's, men's, children's, and mental-health topics
• Understanding lab/blood test results

You ground every answer in mainstream guidelines (WHO, NICE, AHA, ADA, NIH, CDC, Mayo Clinic).
When [RETRIEVED HEALTHCARE KNOWLEDGE] is provided below your role, treat those
sources as your primary reference — synthesize from them rather than from memory.

══════════════════════════════════════════════════════════════════
  WHAT YOU DO NOT DO  (CRITICAL — THIS APP HAS A SEPARATE SYMPTOM ANALYZER)
══════════════════════════════════════════════════════════════════
🚫 You are NOT a symptom checker, triage tool, or diagnostic engine.
🚫 You do NOT analyze the user's personal symptoms.
🚫 You do NOT say "you might have <disease>" based on described symptoms.
🚫 You do NOT generate probability scores or differential diagnoses for the user.
🚫 You do NOT overlap with the dedicated Symptom Analyzer feature in this app.

══════════════════════════════════════════════════════════════════
  SYMPTOM REDIRECT RULE  (FOLLOW THIS EXACTLY)
══════════════════════════════════════════════════════════════════
If a user's message describes their OWN symptoms — e.g.,
  "I have a headache", "my chest hurts", "I've been feeling dizzy",
  "I'm experiencing fever and cough", "what's wrong with me", "since yesterday I…"
— respond using this exact structure:

  1. One warm, empathetic sentence acknowledging their concern.
  2. State plainly that for a personalized symptom analysis, this app has a
     dedicated tool: the **Symptom Checker** (also called Symptom Analyzer),
     accessible from the left sidebar or the Quick Actions on the dashboard.
     Tell them it is purpose-built for analyzing symptoms with AI and ML.
  3. Offer to share GENERAL educational information about the condition or topic
     they mentioned — explicitly framed as background information, not a
     diagnosis of their case. (e.g., "I can explain how migraines generally
     work and what's known about triggers if that would help.")
  4. Do not list possible diagnoses for them. Do not say what they might have.

If a user asks a GENERAL educational question about symptoms ("what causes
headaches in general?", "why does fever happen?"), that's fine — answer it.
The redirect rule applies only when the user describes THEIR OWN current
symptoms and is implicitly asking what's wrong with them.

══════════════════════════════════════════════════════════════════
  RESPONSE QUALITY STANDARDS
══════════════════════════════════════════════════════════════════
• Be accurate, structured, and evidence-based.
• Use clear headings and bullet points for complex topics.
• Be culturally sensitive — many users are from India and South Asia.
• Use emojis sparingly and only for meaning: ✅ ⚠️ 💊 🏥 🩺 💙 🥗 🚨
• For EMERGENCIES (heart attack, stroke, anaphylaxis, severe asthma, sepsis,
  meningitis, suicidal ideation): start with 🚨 and advise calling emergency
  services (108 in India / 112 / 911 / local equivalent) immediately.
• Always end with: "⚠️ This is general health education. Please consult a
  qualified healthcare professional for personal medical advice and treatment."
• When discussing medications, never recommend specific dosages without
  noting that prescription and physician guidance are required.
• Never say "you have <disease>". Use phrasing like "this condition involves..."
  or "research shows..." or "guidelines recommend...".
"""


# ════════════════════════════════════════════════════════════════════════════
#  SYMPTOM REDIRECT — canned message for the local fallback path
# ════════════════════════════════════════════════════════════════════════════

SYMPTOM_REDIRECT_MESSAGE = (
    "I hear you — describing what you're feeling takes courage. 💙\n\n"
    "I'm SwasthyaSeva AI's **healthcare knowledge assistant**, focused on "
    "general medical education rather than personal symptom analysis. "
    "For that, this app has a dedicated tool that's purpose-built for the job:\n\n"
    "🩺 **Symptom Checker** — accessible from the left sidebar, or as a Quick "
    "Action on your dashboard. It uses AI + ML to analyze your symptoms with "
    "urgency levels and suggested next steps.\n\n"
    "If it would help, I'm happy to explain — in general terms — how the "
    "condition or topic you mentioned typically works, what the known causes "
    "are, or how it's managed. Just ask.\n\n"
    "⚠️ This is general health education. Please consult a qualified "
    "healthcare professional for personal medical advice and treatment."
)


# ════════════════════════════════════════════════════════════════════════════
#  PROMPT BUILDER
# ════════════════════════════════════════════════════════════════════════════

def build_system_prompt(
    knowledge_context: str = "",
    user_context: str = "",
) -> str:
    """
    Compose the full system prompt for Claude.

    Order:
      1. Core role / behavior rules (HEALTHCARE_KNOWLEDGE_PROMPT)
      2. Retrieved knowledge context (if any) — primary reference
      3. Patient profile (if any)
    """
    parts = [HEALTHCARE_KNOWLEDGE_PROMPT]

    if knowledge_context:
        parts.append("\n" + knowledge_context)

    if user_context:
        parts.append(
            "\n---\n"
            "Patient profile (use only as background context for tailoring tone "
            "and examples — never as a basis for personal diagnosis):\n"
            f"{user_context}"
        )

    return "\n".join(parts)


# ════════════════════════════════════════════════════════════════════════════
#  CORE API CALL
# ════════════════════════════════════════════════════════════════════════════

async def get_ai_response(
    messages: list[dict],
    user_context: str = "",
    knowledge_context: str = "",
    max_tokens: int = 1500,
    model: str = DEFAULT_MODEL,
) -> str:
    """
    Send a list of chat messages to Claude and return the text response.

    Args:
        messages:          Anthropic-format message list (role + content).
        user_context:      Optional patient profile (vitals, conditions).
        knowledge_context: Optional [RETRIEVED HEALTHCARE KNOWLEDGE] block
                           produced by HealthcareKnowledgeRetriever.format_context().
        max_tokens:        Max output tokens.
        model:             Claude model id.
    """
    system = build_system_prompt(
        knowledge_context=knowledge_context,
        user_context=user_context,
    )

    response = _client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )
    return response.content[0].text


# ════════════════════════════════════════════════════════════════════════════
#  PATIENT CONTEXT BUILDER
# ════════════════════════════════════════════════════════════════════════════

def build_user_context(vitals) -> str:
    """Build patient-profile string from DB vitals."""
    if not vitals:
        return ""
    parts = []
    if vitals.age:            parts.append(f"Age: {vitals.age}")
    if vitals.weight:         parts.append(f"Weight: {vitals.weight} kg")
    if vitals.height:         parts.append(f"Height: {vitals.height} cm")
    if vitals.blood_group:    parts.append(f"Blood Group: {vitals.blood_group}")
    if vitals.blood_pressure: parts.append(f"Blood Pressure: {vitals.blood_pressure}")
    if vitals.conditions:     parts.append(f"Known Conditions: {vitals.conditions}")
    return "\n".join(parts)


# ════════════════════════════════════════════════════════════════════════════
#  REPORT MESSAGE BUILDER (vision / PDF)
# ════════════════════════════════════════════════════════════════════════════

def build_report_messages(
    file_bytes: bytes,
    media_type: str,
    filename: str,
    prompt_text: str,
) -> list[dict]:
    """
    Build Claude API message list for a single-shot report-analysis call.

    Strategy:
      • Images → image block (vision)
      • PDFs   → document block
      • Always append a text prompt block.
    """
    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
    content: list = []

    if media_type.startswith("image/"):
        if "jpeg" in media_type or "jpg" in media_type:
            safe_type = "image/jpeg"
        elif "png" in media_type:
            safe_type = "image/png"
        elif "webp" in media_type:
            safe_type = "image/webp"
        else:
            safe_type = "image/jpeg"

        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": safe_type, "data": b64},
        })

    elif media_type == "application/pdf":
        content.append({
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
        })

    content.append({"type": "text", "text": prompt_text})
    return [{"role": "user", "content": content}]


# ════════════════════════════════════════════════════════════════════════════
#  CHAT MESSAGE BUILDER
# ════════════════════════════════════════════════════════════════════════════

def build_chat_messages(
    history: list,
    text: str,
    file_bytes: bytes | None,
    media_type: str | None,
    filename: str | None,
) -> list[dict]:
    """
    Build the full Claude message list for a chat turn (may include a file).
    history: list of {"role": "user"|"assistant", "content": str}
    """
    # Last 20 messages → Anthropic format
    claude_msgs = [
        {
            "role": m["role"] if m["role"] in ("user", "assistant") else "user",
            "content": m["content"],
        }
        for m in history[-20:]
    ]

    content: list = []

    if file_bytes and media_type:
        b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
        if media_type.startswith("image/"):
            safe = "image/jpeg"
            if "png"  in media_type: safe = "image/png"
            if "webp" in media_type: safe = "image/webp"
            content.append({"type": "image", "source": {"type": "base64", "media_type": safe, "data": b64}})
        elif media_type == "application/pdf":
            content.append({"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}})

    if text.strip():
        suffix = f"\n\n[Attached file: {filename}]" if filename and file_bytes else ""
        content.append({"type": "text", "text": text.strip() + suffix})
    elif file_bytes and filename:
        content.append({"type": "text", "text": f"Please analyse this medical document: {filename}"})

    if content:
        claude_msgs.append({"role": "user", "content": content})

    return claude_msgs
