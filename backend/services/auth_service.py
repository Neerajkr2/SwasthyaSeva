# backend/services/auth_service.py
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
from config import get_settings

settings = get_settings()

# ── Firebase init (singleton) ─────────────────────────────────────────────────
if not firebase_admin._apps:
    cred = credentials.Certificate(settings.firebase_credentials_path)
    firebase_admin.initialize_app(cred)

bearer_scheme = HTTPBearer()

# ── reCAPTCHA v2 verification ─────────────────────────────────────────────────
async def verify_recaptcha(token: str) -> bool:
    """Verify Google reCAPTCHA v2 token against Google's siteverify API."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": settings.recaptcha_secret_key, "response": token},
        )
    data = resp.json()
    return data.get("success", False)

# ── Firebase token verification ───────────────────────────────────────────────
def verify_firebase_token(id_token: str) -> dict:
    """Verify Firebase ID token and return decoded claims."""
    try:
        decoded = firebase_auth.verify_id_token(id_token)
        return decoded
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid Firebase token: {e}")

# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_access_token(user_id: str) -> str:
    payload = {
        "sub":  user_id,
        "exp":  datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes),
        "iat":  datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

def decode_access_token(token: str) -> str:
    """Returns user_id (sub) from JWT, raises 401 on failure."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired or invalid")

# ── FastAPI dependency ────────────────────────────────────────────────────────
def get_current_user_id(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> str:
    """Dependency: extracts + validates JWT Bearer token, returns user_id."""
    return decode_access_token(creds.credentials)
