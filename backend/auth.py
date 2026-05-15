# backend/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.user import User
from schemas.schemas import (
    GoogleLoginRequest, EmailRegisterRequest,
    EmailLoginRequest, AuthResponse, UserOut,
)
from services.auth_service import (
    verify_firebase_token, verify_recaptcha,
    create_access_token, get_current_user_id,
)

router = APIRouter()


# ── Helper: upsert user from Firebase claims ──────────────────────────────────
async def _upsert_user(
    db: AsyncSession,
    claims: dict,
    provider: str = "google",
    override_name: str = None,
) -> User:
    uid   = claims["uid"]
    email = claims.get("email", "")
    name  = override_name or claims.get("name") or claims.get("display_name") or email.split("@")[0]
    photo = claims.get("picture") or claims.get("photo_url")

    # Try to find by Firebase UID first, then by email
    result = await db.execute(select(User).where(User.firebase_uid == uid))
    user   = result.scalar_one_or_none()

    if not user and email:
        # Check if registered with same email via different provider
        result = await db.execute(select(User).where(User.email == email))
        user   = result.scalar_one_or_none()
        if user:
            # Link existing account to this Firebase UID
            user.firebase_uid = uid

    if user:
        # Update mutable fields on every login
        user.name      = name
        user.photo_url = photo
    else:
        user = User(
            firebase_uid=uid, email=email,
            name=name, photo_url=photo, provider=provider,
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reCAPTCHA verification failed. Please try again.",
        )

    # 2. Verify Firebase ID token
    claims = verify_firebase_token(body.id_token)

    # 3. Upsert user in DB
    user = await _upsert_user(db, claims, provider="google")

    # 4. Issue our own JWT
    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user))


# ── POST /auth/register ───────────────────────────────────────────────────────
@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register_email(
    body: EmailRegisterRequest,
    db:   AsyncSession = Depends(get_db),
):
    if not await verify_recaptcha(body.captcha_token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reCAPTCHA verification failed. Please try again.",
        )

    claims = verify_firebase_token(body.id_token)
    user   = await _upsert_user(db, claims, provider="email", override_name=body.name)
    token  = create_access_token(user.id)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user))


# ── POST /auth/login ──────────────────────────────────────────────────────────
@router.post("/login", response_model=AuthResponse)
async def login_email(
    body: EmailLoginRequest,
    db:   AsyncSession = Depends(get_db),
):
    if not await verify_recaptcha(body.captcha_token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reCAPTCHA verification failed. Please try again.",
        )

    claims = verify_firebase_token(body.id_token)
    user   = await _upsert_user(db, claims, provider="email")
    token  = create_access_token(user.id)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user))


# ── GET /auth/me ──────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserOut)
async def get_me(
    user_id: str       = Depends(get_current_user_id),
    db: AsyncSession   = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user   = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return UserOut.model_validate(user)
