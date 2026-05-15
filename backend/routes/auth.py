# backend/routes/auth.py
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.user import User
from schemas.schemas import GoogleLoginRequest, EmailRegisterRequest, EmailLoginRequest, AuthResponse, UserOut
from services.auth_service import (
    verify_firebase_token, verify_recaptcha,
    create_access_token, get_current_user_id,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helper: get-or-create user ────────────────────────────────────────────────
async def _upsert_user(db: AsyncSession, firebase_claims: dict, provider: str = "google") -> User:
    uid   = firebase_claims["uid"]
    email = (firebase_claims.get("email") or "").lower().strip()
    name  = firebase_claims.get("name") or firebase_claims.get("display_name") or (email.split("@")[0] if email else "User")
    photo = firebase_claims.get("picture") or firebase_claims.get("photo_url")

    if not uid or not email:
        # Should never happen with a verified Firebase token, but guard anyway.
        raise HTTPException(status_code=400, detail="Authentication payload missing uid/email.")

    result = await db.execute(select(User).where(User.firebase_uid == uid))
    user   = result.scalar_one_or_none()

    if user:
        # Update mutable fields on every login so they stay fresh
        user.name      = name
        if photo:
            user.photo_url = photo
        if provider and not user.provider:
            user.provider = provider
    else:
        # Defensive: also check for an existing row with the same email but a
        # different firebase_uid (e.g. user previously signed up with email/password
        # and is now using Google). Re-link the row instead of creating a duplicate.
        existing_email = await db.execute(select(User).where(User.email == email))
        twin = existing_email.scalar_one_or_none()
        if twin:
            twin.firebase_uid = uid
            twin.name         = name
            if photo:
                twin.photo_url = photo
            twin.provider = provider
            user = twin
        else:
            user = User(
                firebase_uid=uid,
                email=email,
                name=name,
                photo_url=photo,
                provider=provider,
                role="user",        # explicit — don't rely on column default for fresh rows
                is_active=True,
            )
            db.add(user)

    await db.flush()
    await db.refresh(user)
    return user

# ── POST /auth/google ─────────────────────────────────────────────────────────
@router.post("/google", response_model=AuthResponse)
async def login_with_google(
    body: GoogleLoginRequest,
    db:   AsyncSession = Depends(get_db),
):
    # 1. Verify reCAPTCHA
    if not await verify_recaptcha(body.captcha_token):
        raise HTTPException(status_code=400, detail="reCAPTCHA verification failed. Please try again.")

    # 2. Verify Firebase token
    claims = verify_firebase_token(body.id_token)

    # 3. Upsert user in DB
    try:
        user = await _upsert_user(db, claims, provider="google")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Google login: failed to upsert user")
        raise HTTPException(status_code=500, detail=f"Could not create or fetch your account: {exc}")

    # 4. Issue our JWT
    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user))


# ── POST /auth/register (email/password) ─────────────────────────────────────
@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register_email(
    body: EmailRegisterRequest,
    db:   AsyncSession = Depends(get_db),
):
    if not await verify_recaptcha(body.captcha_token):
        raise HTTPException(status_code=400, detail="reCAPTCHA verification failed.")

    claims = verify_firebase_token(body.id_token)

    # Check email not already registered
    try:
        existing = await db.execute(select(User).where(User.email == body.email.lower().strip()))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="An account with this email already exists.")

        user = await _upsert_user(db, {**claims, "name": body.name}, provider="email")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Email register: failed to upsert user")
        raise HTTPException(status_code=500, detail=f"Registration failed: {exc}")

    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user))


# ── POST /auth/login (email/password) ────────────────────────────────────────
@router.post("/login", response_model=AuthResponse)
async def login_email(
    body: EmailLoginRequest,
    db:   AsyncSession = Depends(get_db),
):
    if not await verify_recaptcha(body.captcha_token):
        raise HTTPException(status_code=400, detail="reCAPTCHA verification failed.")

    claims = verify_firebase_token(body.id_token)
    try:
        user = await _upsert_user(db, claims, provider="email")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Email login: failed to upsert user")
        raise HTTPException(status_code=500, detail=f"Login failed: {exc}")

    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user))


# ── GET /auth/me ──────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserOut)
async def get_me(
    user_id: str       = Depends(get_current_user_id),
    db:      AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user   = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return UserOut.model_validate(user)
