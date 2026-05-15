# backend/routes/doctors.py
"""
Doctor Directory API — Module 6
Endpoints for browsing, filtering, and getting doctor recommendations.
"""
import logging
from fastapi import APIRouter, Query
from typing import Optional

from services.doctor_directory import DoctorDirectory

logger = logging.getLogger(__name__)
router = APIRouter()
directory = DoctorDirectory()


@router.get("/list")
async def list_doctors(
    specialty:  Optional[str] = Query(None),
    location:   Optional[str] = Query(None),
    search:     Optional[str] = Query(None),
    min_rating: float         = Query(0, ge=0, le=5),
    sort_by:    str           = Query("rating"),
):
    """List / filter / search doctors."""
    doctors = directory.list_all(
        specialty=specialty,
        location=location,
        search=search,
        min_rating=min_rating,
        sort_by=sort_by,
    )
    return {
        "doctors": doctors,
        "total":   len(doctors),
    }


@router.get("/specialties")
async def get_specialties():
    """Return all available specialties."""
    return {"specialties": directory.get_specialties()}


@router.get("/locations")
async def get_locations():
    """Return all available locations."""
    return {"locations": directory.get_locations()}


@router.get("/recommend")
async def recommend_doctors(symptoms: str = Query(..., min_length=2)):
    """Recommend doctors based on symptom text (cross-module integration)."""
    doctors = directory.recommend_for_symptoms(symptoms)
    return {
        "doctors":  doctors,
        "total":    len(doctors),
        "symptoms": symptoms,
    }


@router.get("/{doctor_id}")
async def get_doctor(doctor_id: str):
    """Get a single doctor profile by ID."""
    doc = directory.get_by_id(doctor_id)
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(404, "Doctor not found")
    return doc
