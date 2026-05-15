# backend/services/doctor_directory.py
"""
Doctor Directory Service — Module 6
====================================
Curated directory of doctors with specialty filtering, search, and
cross-module integration with the Symptom Checker.

This is a static in-memory directory designed for demonstration and
educational purposes. In production, this would be backed by a database
with verified doctor profiles and real-time availability.
"""
from __future__ import annotations
import re
from typing import List, Dict, Any, Optional

# ═════════════════════════════════════════════════════════════════════════════
#  DOCTOR DATABASE
# ═════════════════════════════════════════════════════════════════════════════
DOCTORS: List[Dict[str, Any]] = [
    # ── General Medicine ─────────────────────────────────────────────────
    {
        "id": "doc-001",
        "name": "Dr. Rajesh Kumar",
        "specialty": "General Medicine",
        "qualifications": "MBBS, MD (Internal Medicine)",
        "hospital": "Apollo Hospital",
        "location": "New Delhi",
        "rating": 4.8,
        "experience_years": 18,
        "consultation_fee": 800,
        "available_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "available_hours": "9:00 AM - 5:00 PM",
        "bio": "Experienced general physician specializing in preventive medicine, chronic disease management, and comprehensive health checkups. Known for patient-centered care and thorough diagnostic approach.",
        "specializations": ["Preventive Medicine", "Chronic Disease Management", "Diabetes", "Hypertension"],
        "languages": ["Hindi", "English"],
        "is_verified": True,
        "gender": "male",
    },
    {
        "id": "doc-002",
        "name": "Dr. Priya Sharma",
        "specialty": "General Medicine",
        "qualifications": "MBBS, DNB (Family Medicine)",
        "hospital": "Fortis Healthcare",
        "location": "Mumbai",
        "rating": 4.7,
        "experience_years": 12,
        "consultation_fee": 700,
        "available_days": ["Mon", "Wed", "Fri", "Sat"],
        "available_hours": "10:00 AM - 6:00 PM",
        "bio": "Compassionate family physician with expertise in managing multi-system disorders, infectious diseases, and geriatric care. Advocates holistic health approaches.",
        "specializations": ["Family Medicine", "Geriatrics", "Infectious Disease", "Lifestyle Medicine"],
        "languages": ["Hindi", "English", "Marathi"],
        "is_verified": True,
        "gender": "female",
    },
    # ── Cardiology ───────────────────────────────────────────────────────
    {
        "id": "doc-003",
        "name": "Dr. Arun Mehta",
        "specialty": "Cardiology",
        "qualifications": "MBBS, MD, DM (Cardiology)",
        "hospital": "Max Super Speciality Hospital",
        "location": "New Delhi",
        "rating": 4.9,
        "experience_years": 22,
        "consultation_fee": 1500,
        "available_days": ["Mon", "Tue", "Thu", "Fri"],
        "available_hours": "10:00 AM - 4:00 PM",
        "bio": "Leading interventional cardiologist with 22 years of experience. Performed over 5000 cardiac procedures including angioplasty and stenting. Expert in heart failure management.",
        "specializations": ["Interventional Cardiology", "Heart Failure", "Preventive Cardiology", "Echocardiography"],
        "languages": ["Hindi", "English"],
        "is_verified": True,
        "gender": "male",
    },
    {
        "id": "doc-004",
        "name": "Dr. Sunita Reddy",
        "specialty": "Cardiology",
        "qualifications": "MBBS, MD, DM (Cardiology), FACC",
        "hospital": "AIIMS",
        "location": "Hyderabad",
        "rating": 4.8,
        "experience_years": 16,
        "consultation_fee": 1200,
        "available_days": ["Tue", "Wed", "Thu", "Sat"],
        "available_hours": "9:00 AM - 3:00 PM",
        "bio": "Heart rhythm specialist with fellowship training in electrophysiology. Research interests in women's heart health and cardiac rehabilitation.",
        "specializations": ["Electrophysiology", "Arrhythmia", "Women's Heart Health", "Cardiac Rehabilitation"],
        "languages": ["Telugu", "Hindi", "English"],
        "is_verified": True,
        "gender": "female",
    },
    # ── Neurology ────────────────────────────────────────────────────────
    {
        "id": "doc-005",
        "name": "Dr. Vikram Singh",
        "specialty": "Neurology",
        "qualifications": "MBBS, MD, DM (Neurology)",
        "hospital": "Medanta - The Medicity",
        "location": "Gurugram",
        "rating": 4.9,
        "experience_years": 20,
        "consultation_fee": 1800,
        "available_days": ["Mon", "Wed", "Fri"],
        "available_hours": "11:00 AM - 5:00 PM",
        "bio": "Renowned neurologist specializing in stroke management, epilepsy, and neurodegenerative diseases. Pioneer in minimally invasive neurosurgical techniques in North India.",
        "specializations": ["Stroke", "Epilepsy", "Movement Disorders", "Headache & Migraine"],
        "languages": ["Hindi", "English", "Punjabi"],
        "is_verified": True,
        "gender": "male",
    },
    # ── Orthopedics ──────────────────────────────────────────────────────
    {
        "id": "doc-006",
        "name": "Dr. Deepak Joshi",
        "specialty": "Orthopedics",
        "qualifications": "MBBS, MS (Orthopedics), Fellowship Joint Replacement",
        "hospital": "Kokilaben Dhirubhai Ambani Hospital",
        "location": "Mumbai",
        "rating": 4.7,
        "experience_years": 15,
        "consultation_fee": 1200,
        "available_days": ["Mon", "Tue", "Wed", "Thu", "Sat"],
        "available_hours": "9:00 AM - 4:00 PM",
        "bio": "Expert in joint replacement surgery and sports medicine. Performed 3000+ successful joint replacements. Active in arthroscopic surgery and fracture management.",
        "specializations": ["Joint Replacement", "Sports Medicine", "Arthroscopy", "Spine Surgery"],
        "languages": ["Hindi", "English", "Marathi"],
        "is_verified": True,
        "gender": "male",
    },
    # ── Dermatology ──────────────────────────────────────────────────────
    {
        "id": "doc-007",
        "name": "Dr. Ananya Patel",
        "specialty": "Dermatology",
        "qualifications": "MBBS, MD (Dermatology), Fellowship Cosmetic Dermatology",
        "hospital": "Manipal Hospital",
        "location": "Bangalore",
        "rating": 4.6,
        "experience_years": 10,
        "consultation_fee": 900,
        "available_days": ["Mon", "Tue", "Wed", "Fri", "Sat"],
        "available_hours": "10:00 AM - 6:00 PM",
        "bio": "Skilled dermatologist with expertise in acne management, psoriasis, eczema, and cosmetic procedures. Pioneer in laser therapy and PRP treatments in South India.",
        "specializations": ["Acne", "Psoriasis", "Cosmetic Dermatology", "Laser Therapy"],
        "languages": ["Kannada", "Hindi", "English"],
        "is_verified": True,
        "gender": "female",
    },
    # ── Pulmonology ──────────────────────────────────────────────────────
    {
        "id": "doc-008",
        "name": "Dr. Mohammad Hussain",
        "specialty": "Pulmonology",
        "qualifications": "MBBS, MD (Pulmonary Medicine), FCCP",
        "hospital": "Sir Ganga Ram Hospital",
        "location": "New Delhi",
        "rating": 4.8,
        "experience_years": 17,
        "consultation_fee": 1100,
        "available_days": ["Mon", "Tue", "Thu", "Fri"],
        "available_hours": "10:00 AM - 5:00 PM",
        "bio": "Pulmonary and critical care specialist with extensive experience in COPD, asthma, sleep disorders, and interventional pulmonology.",
        "specializations": ["Asthma", "COPD", "Sleep Disorders", "Interventional Pulmonology"],
        "languages": ["Hindi", "English", "Urdu"],
        "is_verified": True,
        "gender": "male",
    },
    # ── Gastroenterology ─────────────────────────────────────────────────
    {
        "id": "doc-009",
        "name": "Dr. Kavitha Rao",
        "specialty": "Gastroenterology",
        "qualifications": "MBBS, MD, DM (Gastroenterology)",
        "hospital": "Narayana Health",
        "location": "Bangalore",
        "rating": 4.7,
        "experience_years": 14,
        "consultation_fee": 1300,
        "available_days": ["Mon", "Wed", "Thu", "Sat"],
        "available_hours": "9:00 AM - 4:00 PM",
        "bio": "Gastroenterologist specializing in liver diseases, IBD, endoscopic procedures, and pancreatic disorders. Known for expertise in therapeutic endoscopy.",
        "specializations": ["Liver Disease", "IBD", "Endoscopy", "Pancreatic Disorders"],
        "languages": ["Kannada", "Telugu", "Hindi", "English"],
        "is_verified": True,
        "gender": "female",
    },
    # ── Psychiatry ───────────────────────────────────────────────────────
    {
        "id": "doc-010",
        "name": "Dr. Neha Gupta",
        "specialty": "Psychiatry",
        "qualifications": "MBBS, MD (Psychiatry), Fellowship CBT",
        "hospital": "NIMHANS",
        "location": "Bangalore",
        "rating": 4.9,
        "experience_years": 13,
        "consultation_fee": 1000,
        "available_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "available_hours": "10:00 AM - 6:00 PM",
        "bio": "Compassionate psychiatrist specializing in anxiety disorders, depression, OCD, and addiction medicine. Trained in CBT and mindfulness-based therapies.",
        "specializations": ["Depression", "Anxiety", "OCD", "Addiction Medicine"],
        "languages": ["Hindi", "English"],
        "is_verified": True,
        "gender": "female",
    },
    # ── Pediatrics ───────────────────────────────────────────────────────
    {
        "id": "doc-011",
        "name": "Dr. Suresh Nair",
        "specialty": "Pediatrics",
        "qualifications": "MBBS, MD (Pediatrics), Fellowship Neonatology",
        "hospital": "Rainbow Children's Hospital",
        "location": "Chennai",
        "rating": 4.8,
        "experience_years": 19,
        "consultation_fee": 800,
        "available_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        "available_hours": "9:00 AM - 5:00 PM",
        "bio": "Senior pediatrician with special interest in neonatal care, childhood infections, vaccination counseling, and developmental pediatrics.",
        "specializations": ["Neonatology", "Vaccination", "Developmental Pediatrics", "Childhood Infections"],
        "languages": ["Tamil", "Hindi", "English", "Malayalam"],
        "is_verified": True,
        "gender": "male",
    },
    # ── Endocrinology ────────────────────────────────────────────────────
    {
        "id": "doc-012",
        "name": "Dr. Meera Krishnan",
        "specialty": "Endocrinology",
        "qualifications": "MBBS, MD, DM (Endocrinology)",
        "hospital": "Amrita Hospital",
        "location": "Kochi",
        "rating": 4.7,
        "experience_years": 11,
        "consultation_fee": 1100,
        "available_days": ["Tue", "Wed", "Thu", "Fri"],
        "available_hours": "10:00 AM - 5:00 PM",
        "bio": "Endocrinologist focusing on diabetes management, thyroid disorders, PCOS, and metabolic syndrome. Strong advocate for lifestyle-based interventions.",
        "specializations": ["Diabetes", "Thyroid Disorders", "PCOS", "Metabolic Syndrome"],
        "languages": ["Malayalam", "Hindi", "English"],
        "is_verified": True,
        "gender": "female",
    },
    # ── ENT ──────────────────────────────────────────────────────────────
    {
        "id": "doc-013",
        "name": "Dr. Amit Saxena",
        "specialty": "ENT",
        "qualifications": "MBBS, MS (ENT), Fellowship Otology",
        "hospital": "BLK Super Speciality Hospital",
        "location": "New Delhi",
        "rating": 4.6,
        "experience_years": 14,
        "consultation_fee": 900,
        "available_days": ["Mon", "Wed", "Fri", "Sat"],
        "available_hours": "10:00 AM - 4:00 PM",
        "bio": "ENT surgeon specializing in cochlear implants, sinus surgery, and voice disorders. Expert in endoscopic ear and sinus procedures.",
        "specializations": ["Sinus Surgery", "Cochlear Implant", "Voice Disorders", "Hearing Loss"],
        "languages": ["Hindi", "English"],
        "is_verified": True,
        "gender": "male",
    },
    # ── Ophthalmology ────────────────────────────────────────────────────
    {
        "id": "doc-014",
        "name": "Dr. Lakshmi Iyer",
        "specialty": "Ophthalmology",
        "qualifications": "MBBS, MS (Ophthalmology), Fellowship Retina",
        "hospital": "Sankara Nethralaya",
        "location": "Chennai",
        "rating": 4.9,
        "experience_years": 16,
        "consultation_fee": 1000,
        "available_days": ["Mon", "Tue", "Wed", "Thu"],
        "available_hours": "9:00 AM - 3:00 PM",
        "bio": "Renowned retina specialist with expertise in diabetic retinopathy, macular degeneration, and vitreoretinal surgery. Performed over 8000 eye surgeries.",
        "specializations": ["Retina", "Diabetic Retinopathy", "Cataract Surgery", "LASIK"],
        "languages": ["Tamil", "Hindi", "English"],
        "is_verified": True,
        "gender": "female",
    },
    # ── Urology ──────────────────────────────────────────────────────────
    {
        "id": "doc-015",
        "name": "Dr. Rahul Verma",
        "specialty": "Urology",
        "qualifications": "MBBS, MS, MCh (Urology)",
        "hospital": "Medanta - The Medicity",
        "location": "Gurugram",
        "rating": 4.7,
        "experience_years": 18,
        "consultation_fee": 1400,
        "available_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "available_hours": "10:00 AM - 5:00 PM",
        "bio": "Senior urologist specializing in robotic surgery for prostate and kidney cancers, kidney stone management, and reconstructive urology.",
        "specializations": ["Robotic Surgery", "Kidney Stones", "Prostate Health", "Reconstructive Urology"],
        "languages": ["Hindi", "English"],
        "is_verified": True,
        "gender": "male",
    },
    # ── Gynecology ───────────────────────────────────────────────────────
    {
        "id": "doc-016",
        "name": "Dr. Shalini Agarwal",
        "specialty": "Gynecology",
        "qualifications": "MBBS, MD (OB-GYN), Fellowship Reproductive Medicine",
        "hospital": "Cloudnine Hospital",
        "location": "Pune",
        "rating": 4.8,
        "experience_years": 15,
        "consultation_fee": 1000,
        "available_days": ["Mon", "Tue", "Wed", "Fri", "Sat"],
        "available_hours": "9:00 AM - 5:00 PM",
        "bio": "Experienced obstetrician-gynecologist with expertise in high-risk pregnancy, infertility treatments, and minimally invasive gynecologic surgery.",
        "specializations": ["High-risk Pregnancy", "Infertility", "Laparoscopic Surgery", "PCOS"],
        "languages": ["Hindi", "English", "Marathi"],
        "is_verified": True,
        "gender": "female",
    },
    # ── Oncology ─────────────────────────────────────────────────────────
    {
        "id": "doc-017",
        "name": "Dr. Karthik Srinivasan",
        "specialty": "Oncology",
        "qualifications": "MBBS, MD, DM (Medical Oncology)",
        "hospital": "Tata Memorial Hospital",
        "location": "Mumbai",
        "rating": 4.9,
        "experience_years": 21,
        "consultation_fee": 2000,
        "available_days": ["Mon", "Tue", "Wed", "Thu"],
        "available_hours": "10:00 AM - 4:00 PM",
        "bio": "Leading medical oncologist with expertise in targeted therapy, immunotherapy, and clinical trials. Specializes in breast, lung, and GI cancers.",
        "specializations": ["Breast Cancer", "Lung Cancer", "Immunotherapy", "Clinical Trials"],
        "languages": ["Tamil", "Hindi", "English"],
        "is_verified": True,
        "gender": "male",
    },
    # ── Nephrology ───────────────────────────────────────────────────────
    {
        "id": "doc-018",
        "name": "Dr. Pooja Bhatt",
        "specialty": "Nephrology",
        "qualifications": "MBBS, MD, DM (Nephrology)",
        "hospital": "Kidney Institute",
        "location": "Ahmedabad",
        "rating": 4.6,
        "experience_years": 12,
        "consultation_fee": 1100,
        "available_days": ["Mon", "Wed", "Thu", "Sat"],
        "available_hours": "10:00 AM - 5:00 PM",
        "bio": "Nephrologist specializing in chronic kidney disease, dialysis management, and kidney transplant care. Research interests in diabetic nephropathy.",
        "specializations": ["Chronic Kidney Disease", "Dialysis", "Kidney Transplant", "Diabetic Nephropathy"],
        "languages": ["Gujarati", "Hindi", "English"],
        "is_verified": True,
        "gender": "female",
    },
]

# ═════════════════════════════════════════════════════════════════════════════
#  SPECIALTY → SYMPTOM KEYWORD MAPPING (for cross-module integration)
# ═════════════════════════════════════════════════════════════════════════════
SPECIALTY_KEYWORDS: Dict[str, List[str]] = {
    "General Medicine":  ["fever", "fatigue", "weakness", "weight loss", "general"],
    "Cardiology":        ["chest pain", "heart", "palpitation", "blood pressure", "cholesterol", "cardiac"],
    "Neurology":         ["headache", "migraine", "seizure", "numbness", "dizziness", "stroke", "brain"],
    "Orthopedics":       ["joint pain", "back pain", "fracture", "bone", "arthritis", "knee", "spine"],
    "Dermatology":       ["skin", "rash", "acne", "eczema", "psoriasis", "hair loss", "itching"],
    "Pulmonology":       ["cough", "breathless", "asthma", "wheezing", "chest", "lung", "breathing"],
    "Gastroenterology":  ["stomach", "abdomen", "nausea", "vomiting", "diarrhea", "liver", "digestion"],
    "Psychiatry":        ["anxiety", "depression", "stress", "insomnia", "mental", "mood", "panic"],
    "Pediatrics":        ["child", "infant", "baby", "vaccination", "growth", "pediatric"],
    "Endocrinology":     ["diabetes", "thyroid", "hormone", "pcos", "metabolism", "sugar"],
    "ENT":               ["ear", "nose", "throat", "sinus", "hearing", "tonsil", "voice"],
    "Ophthalmology":     ["eye", "vision", "blurry", "cataract", "glaucoma", "retina"],
    "Urology":           ["kidney", "urinary", "prostate", "bladder", "stone"],
    "Gynecology":        ["menstrual", "pregnancy", "fertility", "ovary", "uterus", "pcos"],
    "Oncology":          ["cancer", "tumor", "lump", "malignant", "chemotherapy"],
    "Nephrology":        ["kidney", "renal", "dialysis", "creatinine", "urea"],
}

# All unique specialties in the directory
ALL_SPECIALTIES = sorted(set(d["specialty"] for d in DOCTORS))
ALL_LOCATIONS   = sorted(set(d["location"] for d in DOCTORS))


# ═════════════════════════════════════════════════════════════════════════════
#  DIRECTORY SERVICE
# ═════════════════════════════════════════════════════════════════════════════
class DoctorDirectory:
    """In-memory doctor directory with search and filtering."""

    def list_all(
        self,
        specialty: Optional[str] = None,
        location:  Optional[str] = None,
        search:    Optional[str] = None,
        min_rating: float = 0,
        sort_by:   str = "rating",
    ) -> List[Dict[str, Any]]:
        """Filter and return doctor profiles."""
        results = DOCTORS[:]

        if specialty:
            s = specialty.lower()
            results = [d for d in results if d["specialty"].lower() == s]

        if location:
            loc = location.lower()
            results = [d for d in results if d["location"].lower() == loc]

        if search:
            q = search.lower()
            results = [d for d in results if (
                q in d["name"].lower() or
                q in d["specialty"].lower() or
                q in d["hospital"].lower() or
                q in d.get("bio", "").lower() or
                any(q in sp.lower() for sp in d.get("specializations", []))
            )]

        if min_rating > 0:
            results = [d for d in results if d["rating"] >= min_rating]

        # Sort
        if sort_by == "rating":
            results.sort(key=lambda d: d["rating"], reverse=True)
        elif sort_by == "experience":
            results.sort(key=lambda d: d["experience_years"], reverse=True)
        elif sort_by == "fee_low":
            results.sort(key=lambda d: d["consultation_fee"])
        elif sort_by == "fee_high":
            results.sort(key=lambda d: d["consultation_fee"], reverse=True)

        return results

    def get_by_id(self, doctor_id: str) -> Optional[Dict[str, Any]]:
        """Get a single doctor by ID."""
        for d in DOCTORS:
            if d["id"] == doctor_id:
                return d
        return None

    def recommend_for_symptoms(self, symptoms: str) -> List[Dict[str, Any]]:
        """Recommend doctors based on symptom text — cross-module integration."""
        if not symptoms:
            return []

        lower = symptoms.lower()
        specialty_scores: Dict[str, int] = {}

        for specialty, keywords in SPECIALTY_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in lower)
            if score > 0:
                specialty_scores[specialty] = score

        if not specialty_scores:
            # Default to general medicine
            specialty_scores["General Medicine"] = 1

        # Get top specialties
        top_specialties = sorted(specialty_scores.keys(), key=lambda s: specialty_scores[s], reverse=True)[:3]

        # Get doctors from those specialties, sorted by rating
        recommended = []
        for spec in top_specialties:
            for d in DOCTORS:
                if d["specialty"] == spec and d not in recommended:
                    recommended.append(d)

        recommended.sort(key=lambda d: d["rating"], reverse=True)
        return recommended[:6]

    def get_specialties(self) -> List[str]:
        return ALL_SPECIALTIES

    def get_locations(self) -> List[str]:
        return ALL_LOCATIONS
