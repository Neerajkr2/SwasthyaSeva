# backend/schemas/schemas.py
from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


def _none(v):
    return None if isinstance(v, str) and v.strip() == "" else v


# Auth
class GoogleLoginRequest(BaseModel):
    id_token: str
    captcha_token: str

class EmailRegisterRequest(BaseModel):
    id_token: str
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    captcha_token: str

class EmailLoginRequest(BaseModel):
    id_token: str
    captcha_token: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    photo_url: Optional[str] = None
    provider: str
    role: str = "user"
    is_active: bool = True
    created_at: datetime
    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# Vitals
class VitalsIn(BaseModel):
    age: Optional[int] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    blood_group: Optional[str] = None
    blood_pressure: Optional[str] = None
    conditions: Optional[str] = None

    @field_validator("age", mode="before")
    @classmethod
    def ve_age(cls, v): return _none(v)
    @field_validator("weight", "height", mode="before")
    @classmethod
    def ve_float(cls, v): return _none(v)
    @field_validator("blood_group", "blood_pressure", "conditions", mode="before")
    @classmethod
    def ve_str(cls, v): return _none(v)

class VitalsOut(VitalsIn):
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# Chat
class SessionOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    message_count: int = 0
    class Config:
        from_attributes = True

class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    file_name: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class SessionDetailOut(SessionOut):
    messages: List[MessageOut] = []


# Reports
class ReportOut(BaseModel):
    id: str
    original_name: str
    file_type: str
    ai_analysis: Optional[str] = None
    extracted_text: Optional[str] = None
    file_data: Optional[str] = None   # base64 data URL — for download
    created_at: datetime
    class Config:
        from_attributes = True


# Dashboard
class DashboardStats(BaseModel):
    chat_count: int
    report_count: int
    created_at: datetime
    vitals: Optional[VitalsOut] = None
    recent_sessions: List[SessionOut] = []


# ML
class SymptomRequest(BaseModel):
    symptoms: str = Field(..., min_length=3, max_length=2000)

class SymptomResult(BaseModel):
    conditions: List[Dict[str, Any]]
    urgency: str
    recommendation: str
    body_systems: List[str] = []
    self_care: Dict[str, Any] = {}
    food_guidance: Dict[str, Any] = {}
    specialists: List[str] = []
    recovery_plan: Dict[str, Any] = {}
    follow_up_questions: List[Dict[str, Any]] = []
    disclaimer: str

class RiskRequest(BaseModel):
    age: Optional[float] = None
    gender: str = "male"
    bmi: Optional[float] = None
    glucose: Optional[float] = None
    blood_pressure: Optional[float] = None
    cholesterol: Optional[float] = None
    smoking: int = 0
    family_history: int = 0
    weight: Optional[float] = None
    height: Optional[float] = None

    @field_validator("age","bmi","glucose","blood_pressure","cholesterol","weight","height", mode="before")
    @classmethod
    def coerce(cls, v): return _none(v)

class RiskResult(BaseModel):
    risks: Dict[str, float]
    recommendation: str
    disclaimer: str

class DrugRequest(BaseModel):
    drugs: List[str] = Field(..., min_length=2)

class DrugInteraction(BaseModel):
    drug1: str
    drug2: str
    severity: str
    description: str
    action: str
    mechanism: str = ""

class FoodInteraction(BaseModel):
    drug: str
    food: str
    examples: List[str] = []
    severity: str
    effect: str
    advice: str

class DrugInfo(BaseModel):
    name: str
    drug_class: str = "Unknown"
    category: str = "General"
    icon: str = "💊"

class TimingAdvice(BaseModel):
    drug: str
    when: str
    detail: str

class DrugResult(BaseModel):
    interactions: List[DrugInteraction]
    safe: bool
    summary: str
    food_interactions: List[FoodInteraction] = []
    drug_info: List[DrugInfo] = []
    timing_advice: List[TimingAdvice] = []
    alternatives: Dict[str, List[Dict[str, str]]] = {}
    safety_score: int = 100
    severity_counts: Dict[str, int] = {}

class ReportAnalysisResult(BaseModel):
    extracted_text: str
    report_type: str = "general"
    health_score: int = 75
    lab_values: List[Dict[str, Any]]
    abnormal_values: List[Dict[str, Any]]
    conditions: List[Dict[str, Any]] = []
    medicines: List[Dict[str, Any]] = []
    categories: Dict[str, List[Dict[str, Any]]] = {}
    ai_interpretation: str = ""
    diet_plan: Dict[str, Any] = {}
    exercise_plan: Dict[str, Any] = {}
    recovery_roadmap: Dict[str, Any] = {}
    follow_up: Dict[str, Any] = {}
    disclaimer: str
