# backend/main.py

# 🔽 ADD THIS (loads .env file into environment variables)
from dotenv import load_dotenv
load_dotenv()  # This ensures .env variables are available before anything else

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from config import get_settings
from database import create_tables
from routes import auth, chat, users, ml, contact, doctors
from middleware.rate_limit import RateLimitMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ⚠️ IMPORTANT: settings should be loaded AFTER .env is loaded
settings = get_settings()

# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 SwasthyaSeva API starting up…")

    # Validate env vars and config before doing anything else
    from startup_checks import run_startup_checks
    run_startup_checks()

    await create_tables()

    # Pre-load ML models once at startup
    from ml.disease_predictor import DiseasePredictor
    from ml.symptom_analyzer  import SymptomAnalyzer
    from ml.drug_interaction  import DrugInteractionChecker
    from ml.nb_predictor      import NBPredictor

    app.state.disease_predictor = DiseasePredictor()
    app.state.symptom_analyzer  = SymptomAnalyzer()
    app.state.drug_checker      = DrugInteractionChecker()

    # Naive Bayes predictor — integrated from Medical_project-main
    try:
        app.state.nb_predictor = NBPredictor()
        logger.info("✅ NBPredictor loaded")
    except FileNotFoundError as exc:
        logger.warning("⚠️  NBPredictor unavailable (%s) — /ml/symptoms/select will return 503", exc)
        app.state.nb_predictor = None

    logger.info("✅ ML models loaded")

    # ── Healthcare Knowledge Retriever (RAG) ──────────────────────────────
    # Adapted from the medical-chatbot reference architecture
    # (LangChain + Pinecone) — implemented here with TF-IDF + cosine
    # similarity over a curated knowledge base. The retriever is the
    # grounding layer for SwasthyaSeva AI's chat responses.
    from services.rag_service import HealthcareKnowledgeRetriever

    app.state.knowledge_retriever = HealthcareKnowledgeRetriever()
    logger.info(
        "✅ Healthcare Knowledge Retriever loaded (%d articles)",
        app.state.knowledge_retriever.article_count(),
    )

    yield
    logger.info("👋 Shutting down…")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SwasthyaSeva API",
    description="AI-Powered Healthcare Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,    prefix="/auth",    tags=["Authentication"])
app.include_router(chat.router,    prefix="/chat",    tags=["Chat"])
app.include_router(users.router,   prefix="/users",   tags=["Users"])
app.include_router(ml.router,      prefix="/ml",      tags=["ML / AI"])
app.include_router(contact.router, prefix="",         tags=["Contact"])
app.include_router(doctors.router, prefix="/doctors",  tags=["Doctors"])


# ── Global exception handler ─────────────────────────────────────────────────
# Without this, an unhandled exception bubbles past the CORS middleware and the
# browser sees a CORS-less 500, which axios surfaces as "Network Error".
# This handler guarantees a JSON body AND CORS headers on every error.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}")
    origin = request.headers.get("origin", "")
    cors_headers = {}
    if origin and (origin in settings.origins_list or "*" in settings.origins_list):
        cors_headers = {
            "Access-Control-Allow-Origin":      origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary":                             "Origin",
        }
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {exc.__class__.__name__}: {exc}"},
        headers=cors_headers,
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "SwasthyaSeva API"}