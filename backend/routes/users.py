# backend/routes/users.py
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models.user import User, UserVitals, MedicalReport, ChatSession, ChatMessage
from schemas.schemas import VitalsIn, VitalsOut, ReportOut, DashboardStats, SessionOut, UserOut
from services.auth_service import get_current_user_id

logger = logging.getLogger(__name__)
router = APIRouter()


class PhotoUpdateRequest(BaseModel):
    # Stored in TEXT column — no length limit
    photo_url: str


class RoleUpdateRequest(BaseModel):
    role: str  # 'user' | 'admin'


# ─────────────────────────────────────────────────────────────────────────────
# USER ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/vitals", response_model=VitalsOut)
async def get_vitals(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(UserVitals).where(UserVitals.user_id == user_id))
    v   = res.scalar_one_or_none()
    return VitalsOut.model_validate(v) if v else VitalsOut()


@router.put("/vitals", response_model=VitalsOut)
async def update_vitals(body: VitalsIn, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(UserVitals).where(UserVitals.user_id == user_id))
    v   = res.scalar_one_or_none()
    if v:
        for k, val in body.model_dump(exclude_none=True).items():
            setattr(v, k, val)
    else:
        v = UserVitals(user_id=user_id, **body.model_dump(exclude_none=True))
        db.add(v)
    await db.flush()
    await db.refresh(v)
    return VitalsOut.model_validate(v)


@router.patch("/photo", response_model=UserOut)
async def update_photo(body: PhotoUpdateRequest, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """
    Save profile photo URL.
    photo_url column is TEXT (unlimited length) — accepts base64 data URLs.
    The migration_001.py script widens the column if it was VARCHAR(512).
    """
    if not body.photo_url:
        raise HTTPException(400, "photo_url cannot be empty")
    if not (body.photo_url.startswith("data:image/") or body.photo_url.startswith("https://")):
        raise HTTPException(400, "photo_url must be a base64 data URL or HTTPS URL")

    res  = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    user.photo_url = body.photo_url
    await db.flush()
    await db.refresh(user)
    logger.info(f"Photo updated for user {user_id} — {len(body.photo_url)} chars")
    return UserOut.model_validate(user)


@router.get("/reports", response_model=list[ReportOut])
async def get_reports(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(MedicalReport).where(MedicalReport.user_id == user_id).order_by(MedicalReport.created_at.desc())
    )
    return [ReportOut.model_validate(r) for r in res.scalars().all()]


@router.get("/reports/{report_id}", response_model=ReportOut)
async def get_single_report(report_id: str, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(MedicalReport).where(MedicalReport.id == report_id, MedicalReport.user_id == user_id)
    )
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Report not found")
    return ReportOut.model_validate(r)


@router.delete("/reports/{report_id}", status_code=204)
async def delete_report(report_id: str, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(MedicalReport).where(MedicalReport.id == report_id, MedicalReport.user_id == user_id)
    )
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Report not found")
    await db.delete(r)


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user_res = await db.execute(
        select(User).options(selectinload(User.vitals)).where(User.id == user_id)
    )
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    chat_cnt = await db.scalar(select(func.count(ChatSession.id)).where(ChatSession.user_id == user_id))
    rep_cnt  = await db.scalar(select(func.count(MedicalReport.id)).where(MedicalReport.user_id == user_id))

    msg_sq = (
        select(ChatMessage.session_id, func.count(ChatMessage.id).label("cnt"))
        .group_by(ChatMessage.session_id).subquery()
    )
    sess_rows = await db.execute(
        select(ChatSession, msg_sq.c.cnt)
        .outerjoin(msg_sq, ChatSession.id == msg_sq.c.session_id)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc()).limit(5)
    )
    sessions = [
        SessionOut(id=s.id, title=s.title, created_at=s.created_at, message_count=cnt or 0)
        for s, cnt in sess_rows.all()
    ]
    vitals_out = VitalsOut.model_validate(user.vitals) if user.vitals else None
    return DashboardStats(
        chat_count=chat_cnt or 0, report_count=rep_cnt or 0,
        created_at=user.created_at, vitals=vitals_out, recent_sessions=sessions,
    )


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN ENDPOINTS  (require role = 'admin' or 'superadmin')
# ─────────────────────────────────────────────────────────────────────────────

async def _require_admin(user_id: str, db: AsyncSession):
    """Dependency helper — raises 403 if caller is not admin."""
    res  = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user or user.role not in ("admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    return user


@router.get("/admin/all", response_model=list[UserOut])
async def admin_list_users(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """List all registered users — admin only."""
    await _require_admin(user_id, db)
    rows = await db.execute(select(User).order_by(User.created_at.desc()))
    return [UserOut.model_validate(u) for u in rows.scalars().all()]


@router.get("/admin/stats")
async def admin_stats(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Platform-wide stats — admin only."""
    await _require_admin(user_id, db)
    total_users    = await db.scalar(select(func.count(User.id)))
    total_chats    = await db.scalar(select(func.count(ChatSession.id)))
    total_reports  = await db.scalar(select(func.count(MedicalReport.id)))
    total_messages = await db.scalar(select(func.count(ChatMessage.id)))
    active_users   = await db.scalar(select(func.count(User.id)).where(User.is_active == True))
    admin_count    = await db.scalar(
        select(func.count(User.id)).where(User.role.in_(["admin", "superadmin"]))
    )

    # Provider breakdown
    google_count = await db.scalar(select(func.count(User.id)).where(User.provider == "google"))
    email_count  = await db.scalar(select(func.count(User.id)).where(User.provider == "email"))

    # Growth: users registered in last 7 / 30 days
    now = datetime.now(timezone.utc)
    week_ago  = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    new_users_7d  = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= week_ago)
    )
    new_users_30d = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= month_ago)
    )

    # Messages in last 7 days
    msgs_7d = await db.scalar(
        select(func.count(ChatMessage.id)).where(ChatMessage.created_at >= week_ago)
    )

    # Reports in last 7 days
    reports_7d = await db.scalar(
        select(func.count(MedicalReport.id)).where(MedicalReport.created_at >= week_ago)
    )

    return {
        "total_users":     total_users or 0,
        "total_sessions":  total_chats or 0,
        "total_reports":   total_reports or 0,
        "total_messages":  total_messages or 0,
        "active_users":    active_users or 0,
        "admin_count":     admin_count or 0,
        "google_users":    google_count or 0,
        "email_users":     email_count or 0,
        "new_users_7d":    new_users_7d or 0,
        "new_users_30d":   new_users_30d or 0,
        "messages_7d":     msgs_7d or 0,
        "reports_7d":      reports_7d or 0,
    }


@router.patch("/admin/role/{target_id}", response_model=UserOut)
async def admin_set_role(
    target_id: str,
    body:      RoleUpdateRequest,
    user_id:   str          = Depends(get_current_user_id),
    db:        AsyncSession = Depends(get_db),
):
    """Promote or demote a user — admin only."""
    if body.role not in ("user", "admin"):
        raise HTTPException(400, "role must be 'user' or 'admin'")

    me = await _require_admin(user_id, db)

    res2   = await db.execute(select(User).where(User.id == target_id))
    target = res2.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")
    if target.role == "superadmin":
        raise HTTPException(403, "Cannot modify a superadmin")

    target.role = body.role
    await db.flush()
    await db.refresh(target)
    logger.info(f"Admin {me.email} set role={body.role} for user {target.email}")
    return UserOut.model_validate(target)


@router.delete("/admin/users/{target_id}", status_code=204)
async def admin_delete_user(
    target_id: str,
    user_id:   str          = Depends(get_current_user_id),
    db:        AsyncSession = Depends(get_db),
):
    """Delete any user — admin only."""
    me = await _require_admin(user_id, db)

    res2   = await db.execute(select(User).where(User.id == target_id))
    target = res2.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")
    if target.role == "superadmin":
        raise HTTPException(403, "Cannot delete a superadmin")
    if target.id == user_id:
        raise HTTPException(400, "Cannot delete your own account via admin panel")

    await db.delete(target)
    logger.info(f"Admin {me.email} deleted user {target.email}")


@router.patch("/admin/toggle-active/{target_id}", response_model=UserOut)
async def admin_toggle_active(
    target_id: str,
    user_id:   str          = Depends(get_current_user_id),
    db:        AsyncSession = Depends(get_db),
):
    """Enable/disable a user account — admin only."""
    me = await _require_admin(user_id, db)

    res    = await db.execute(select(User).where(User.id == target_id))
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")
    if target.role == "superadmin":
        raise HTTPException(403, "Cannot modify a superadmin")
    if target.id == user_id:
        raise HTTPException(400, "Cannot deactivate your own account")

    target.is_active = not target.is_active
    await db.flush()
    await db.refresh(target)
    action = "activated" if target.is_active else "deactivated"
    logger.info(f"Admin {me.email} {action} user {target.email}")
    return UserOut.model_validate(target)


@router.get("/admin/user/{target_id}")
async def admin_user_detail(
    target_id: str,
    user_id:   str          = Depends(get_current_user_id),
    db:        AsyncSession = Depends(get_db),
):
    """Get detailed info about a user including activity stats — admin only."""
    await _require_admin(user_id, db)

    res = await db.execute(
        select(User).options(selectinload(User.vitals)).where(User.id == target_id)
    )
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")

    chat_cnt = await db.scalar(
        select(func.count(ChatSession.id)).where(ChatSession.user_id == target_id)
    )
    msg_cnt = await db.scalar(
        select(func.count(ChatMessage.id))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(ChatSession.user_id == target_id)
    )
    report_cnt = await db.scalar(
        select(func.count(MedicalReport.id)).where(MedicalReport.user_id == target_id)
    )

    # Last activity: most recent message or session
    last_msg = await db.scalar(
        select(func.max(ChatMessage.created_at))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(ChatSession.user_id == target_id)
    )

    user_out = UserOut.model_validate(target)
    vitals   = VitalsOut.model_validate(target.vitals) if target.vitals else None

    return {
        "user":         user_out.model_dump(),
        "vitals":       vitals.model_dump() if vitals else None,
        "chat_count":   chat_cnt or 0,
        "message_count": msg_cnt or 0,
        "report_count": report_cnt or 0,
        "last_activity": last_msg.isoformat() if last_msg else None,
    }


@router.get("/admin/activity")
async def admin_recent_activity(
    user_id: str          = Depends(get_current_user_id),
    db:      AsyncSession = Depends(get_db),
):
    """Recent platform activity feed — admin only."""
    await _require_admin(user_id, db)

    activities = []

    # Recent signups (last 10)
    signup_rows = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(10)
    )
    for u in signup_rows.scalars().all():
        activities.append({
            "type":      "signup",
            "user_name": u.name,
            "user_email": u.email,
            "detail":    f"Joined via {u.provider}",
            "timestamp": u.created_at.isoformat() if u.created_at else None,
        })

    # Recent chat sessions (last 10)
    sess_rows = await db.execute(
        select(ChatSession, User.name, User.email)
        .join(User, ChatSession.user_id == User.id)
        .order_by(ChatSession.created_at.desc()).limit(10)
    )
    for sess, name, email in sess_rows.all():
        activities.append({
            "type":      "chat",
            "user_name": name,
            "user_email": email,
            "detail":    sess.title or "Health Consultation",
            "timestamp": sess.created_at.isoformat() if sess.created_at else None,
        })

    # Recent reports (last 10)
    report_rows = await db.execute(
        select(MedicalReport, User.name, User.email)
        .join(User, MedicalReport.user_id == User.id)
        .order_by(MedicalReport.created_at.desc()).limit(10)
    )
    for rep, name, email in report_rows.all():
        activities.append({
            "type":      "report",
            "user_name": name,
            "user_email": email,
            "detail":    rep.original_name,
            "timestamp": rep.created_at.isoformat() if rep.created_at else None,
        })

    # Sort by timestamp descending
    activities.sort(key=lambda a: a["timestamp"] or "", reverse=True)
    return activities[:30]
