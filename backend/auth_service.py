# backend/services/auth_service.py
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from jose import JWTError, jwt, ExpiredSignatureError
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

bearer_scheme = HTTPBearer(auto_error=False)


# ── reCAPTCHA v2 verification ─────────────────────────────────────────────────
async def verify_recaptcha(token: str) -> bool:
    """Verify Google reCAPTCHA v2 token."""
    if not token:
        return False
    # Allow test bypass in development
    if settings.environment == "development" and token == "test-bypass":
        return True
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data={"secret": settings.recaptcha_secret_key, "response": token},
            )
        data = resp.json()
        return data.get("success", False)
    except Exception:
        return False


# ── Firebase token verification ───────────────────────────────────────────────
def verify_firebase_token(id_token: str) -> dict:
    """Verify Firebase ID token and return decoded claims."""
    try:
        decoded = firebase_auth.verify_id_token(id_token)
        return decoded
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Firebase token: {e}",
        )


# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_access_token(user_id: str) -> str:
    """Create a signed JWT containing user_id as 'sub'."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    """Decode JWT and return user_id (sub). Raises 401 on any failure."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload missing subject.",
            )
        return user_id
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )


# ── FastAPI dependency ────────────────────────────────────────────────────────
def get_current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    FastAPI dependency that extracts and validates the Bearer JWT.
    Returns the user_id (UUID string) from the token payload.
    """
    if not creds or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decode_access_token(creds.credentials)
