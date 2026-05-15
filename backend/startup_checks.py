# backend/startup_checks.py
"""
Startup validation — runs before the API starts accepting requests.
Checks critical configuration and service connectivity.
"""
import os, sys, logging
from pathlib import Path

logger = logging.getLogger(__name__)


def validate_environment() -> list[str]:
    """Return list of validation errors (empty = all good)."""
    errors = []

    # Required env vars
    required = {
        "DATABASE_URL":              "PostgreSQL connection string",
        "FIREBASE_CREDENTIALS_PATH": "Path to Firebase service account JSON",
        "JWT_SECRET_KEY":            "JWT signing secret (min 32 chars)",
        "ANTHROPIC_API_KEY":         "Anthropic Claude API key",
        "RECAPTCHA_SECRET_KEY":      "Google reCAPTCHA v2 secret key",
    }

    for var, desc in required.items():
        val = os.getenv(var, "")
        if not val:
            errors.append(f"Missing env var: {var} ({desc})")

    # JWT secret length
    jwt_key = os.getenv("JWT_SECRET_KEY", "")
    if jwt_key and len(jwt_key) < 24:
        errors.append("JWT_SECRET_KEY must be at least 24 characters for security")

    # Firebase credentials file
    creds_path = Path(os.getenv("FIREBASE_CREDENTIALS_PATH", "./firebase-credentials.json"))
    if not creds_path.exists():
        errors.append(
            f"Firebase credentials file not found at: {creds_path.resolve()}\n"
            "  → Download from Firebase Console → Project Settings → Service Accounts"
        )

    # ML models directory
    ml_dir = Path(os.getenv("ML_MODELS_DIR", "./ml/saved_models"))
    if not ml_dir.exists():
        ml_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created ML models directory: {ml_dir}")

    return errors


def warn_missing_models() -> None:
    """Log warnings for missing ML model files (non-fatal — fallbacks exist)."""
    ml_dir = Path(os.getenv("ML_MODELS_DIR", "./ml/saved_models"))
    models = ["diabetes", "heart_disease", "liver_disorder"]
    missing = [d for d in models if not (ml_dir / f"{d}_model.joblib").exists()]

    if missing:
        logger.warning(
            f"⚠️  ML model files not found for: {', '.join(missing)}\n"
            "   → Heuristic fallbacks will be used. Run: python ml/train_models.py"
        )
    else:
        logger.info("✅ All ML model files found")


def run_startup_checks() -> None:
    """
    Run all startup checks. Exits with code 1 if critical errors found.
    Call this from main.py lifespan before app starts.
    """
    errors = validate_environment()

    if errors:
        logger.critical("❌ Startup validation failed:")
        for e in errors:
            logger.critical(f"   • {e}")
        logger.critical(
            "\nCopy backend/.env.example to backend/.env and fill in all values."
        )
        sys.exit(1)

    logger.info("✅ Environment validation passed")
    warn_missing_models()
