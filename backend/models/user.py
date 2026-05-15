# backend/models/user.py
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer,
    Float, ForeignKey, DateTime, func,
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id           = Column(String(36),  primary_key=True, default=_uuid)
    firebase_uid = Column(String(128), unique=True, nullable=False, index=True)
    email        = Column(String(255), unique=True, nullable=False, index=True)
    name         = Column(String(200), nullable=False)
    # TEXT — no length limit. Stores base64 data URLs (30-200 KB) or HTTPS URLs
    photo_url    = Column(Text, nullable=True)
    provider     = Column(String(32), nullable=False, default="email")
    # role: 'user' | 'admin' | 'superadmin'
    role         = Column(String(32), nullable=False, default="user", index=True)
    is_active    = Column(Boolean, nullable=False, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    vitals          = relationship("UserVitals",    back_populates="user", uselist=False, cascade="all, delete-orphan")
    chat_sessions   = relationship("ChatSession",  back_populates="user", cascade="all, delete-orphan")
    medical_reports = relationship("MedicalReport",back_populates="user", cascade="all, delete-orphan")


class UserVitals(Base):
    __tablename__ = "user_vitals"

    id             = Column(Integer,    primary_key=True, autoincrement=True)
    user_id        = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    age            = Column(Integer,    nullable=True)
    weight         = Column(Float,      nullable=True)
    height         = Column(Float,      nullable=True)
    blood_group    = Column(String(8),  nullable=True)
    blood_pressure = Column(String(16), nullable=True)
    conditions     = Column(Text,       nullable=True)
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="vitals")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id         = Column(String(36),  primary_key=True, default=_uuid)
    user_id    = Column(String(36),  ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title      = Column(String(120), nullable=False, default="Health Consultation")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user     = relationship("User",        back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session",
                            cascade="all, delete-orphan",
                            order_by="ChatMessage.created_at")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(String(36), primary_key=True, default=_uuid)
    session_id = Column(String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role       = Column(String(16), nullable=False)
    content    = Column(Text,       nullable=False)
    file_name  = Column(String(255),nullable=True)
    file_type  = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")


class MedicalReport(Base):
    __tablename__ = "medical_reports"

    id             = Column(String(36),  primary_key=True, default=_uuid)
    user_id        = Column(String(36),  ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    original_name  = Column(String(255), nullable=False)
    file_type      = Column(String(64),  nullable=True)
    extracted_text = Column(Text,        nullable=True)
    ai_analysis    = Column(Text,        nullable=True)
    # Stores the uploaded file as base64 data URL so users can re-download it
    file_data      = Column(Text,        nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="medical_reports")
