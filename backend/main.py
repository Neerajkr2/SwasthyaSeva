# backend/main.py

# 🔽 ADD THIS (loads .env file into environment variables)
from dotenv import load_dotenv
load_dotenv()  # This ensures .env variables are available before anything else

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import logging

from config import get_settings
from database import create_tables, check_db_connection
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

    # ── Database init — resilient, NON-FATAL ──────────────────────────────
    # A transient DB outage must NOT take the whole API down. Previously a
    # failed connection here raised in the lifespan, uvicorn exited with
    # status 3, and Render crash-looped — turning a recoverable blip into a
    # full outage. Now we retry a few times, and if the DB is still down we
    # start in DEGRADED mode and keep retrying in the background, so the app
    # recovers on its own once the database comes back.
    app.state.db_ready = False
    await _init_db(app)

    # ── ML models & RAG retriever are LAZY-LOADED on first use ────────────
    # See ml/registry.py. Deferring the heavy model loads keeps cold starts
    # fast and memory low on small instances; each model loads the first time
    # its feature is actually used.
    logger.info("✅ Startup complete (ML models load on first use)")

    yield
    logger.info("👋 Shutting down…")


async def _init_db(app: FastAPI, attempts: int = 3, delay: float = 2.0) -> None:
    """Try to create/sync the schema; on failure, degrade + retry in background."""
    for i in range(1, attempts + 1):
        try:
            await create_tables()
            app.state.db_ready = True
            logger.info("✅ Database ready (schema synced)")
            return
        except Exception as exc:  # noqa: BLE001 — must not crash startup
            logger.warning("DB init attempt %d/%d failed: %s", i, attempts, exc)
            if i < attempts:
                await asyncio.sleep(delay)

    logger.error(
        "⚠️  Database unreachable at startup — running in DEGRADED mode. The API "
        "is up and /health responds; DB-backed routes will fail until the database "
        "recovers. Retrying in the background…"
    )
    asyncio.create_task(_db_retry_loop(app))


async def _db_retry_loop(app: FastAPI, delay: float = 15.0) -> None:
    """Keep trying to sync the schema until the DB comes back, then stop."""
    while not getattr(app.state, "db_ready", False):
        await asyncio.sleep(delay)
        try:
            await create_tables()
            app.state.db_ready = True
            logger.info("✅ Database recovered — schema synced, now fully ready.")
        except Exception as exc:  # noqa: BLE001
            logger.warning("DB still unreachable (%s) — retrying in %.0fs", exc, delay)

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
    # Liveness: always 200 while the process is up. This is the right target
    # for uptime pings / keep-warm — it stays green even during a brief DB
    # blip, so a database hiccup doesn't trigger false "down" alarms.
    return {"status": "ok", "service": "SwasthyaSeva API"}


@app.get("/ready")
async def ready():
    # Readiness: verifies the database is actually reachable right now. Use
    # this (not /health) when you want to know whether DB-backed routes will
    # work. Returns 503 while the app is in DEGRADED mode.
    db_ok = await check_db_connection()
    return JSONResponse(
        status_code=200 if db_ok else 503,
        content={
            "status":   "ready" if db_ok else "degraded",
            "database": "connected" if db_ok else "unreachable",
        },
    )