"""
backend/ml/nb_predictor.py
==========================
Naive Bayes Predictor — integrated from Medical_project-main/ml_service.

Wraps the pre-trained Multinomial Naive Bayes classifier (mnb.pkl) that was
trained on the 377-feature clinical symptom dataset.  Accepts a list of
symptom strings exactly as they appear in the feature list, builds a binary
input vector, and returns top-N disease predictions with confidence scores.

No external network calls (no Gemini / translation) — since symptoms are
selected from the canonical list, direct lookup is sufficient and instant.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

import joblib
import numpy as np

logger = logging.getLogger(__name__)

_HERE   = os.path.dirname(__file__)
_MODELS = os.path.join(_HERE, "saved_models")

# ── Disease → Body System (comprehensive lookup + keyword fallback) ──────────
DISEASE_BODY_SYSTEM: Dict[str, str] = {
    "Asthma": "Respiratory",
    "Acute sinusitis": "Respiratory",
    "Chronic sinusitis": "Respiratory",
    "Pneumonia": "Respiratory",
    "Common Cold": "Respiratory",
    "Laryngitis": "Respiratory",
    "Pharyngitis": "Respiratory",
    "Tonsillitis": "Respiratory",
    "Croup": "Respiratory",
    "Bronchitis": "Respiratory",
    "Tuberculosis": "Respiratory",
    "Influenza": "Respiratory",
    "Whooping Cough": "Respiratory",
    "Angina": "Cardiovascular",
    "Heart Attack": "Cardiovascular",
    "Arrhythmia": "Cardiovascular",
    "Atrial Fibrillation": "Cardiovascular",
    "Hypertension": "Cardiovascular",
    "Coronary Artery Disease": "Cardiovascular",
    "Heart Failure": "Cardiovascular",
    "Migraine": "Neurological",
    "Tension Headache": "Neurological",
    "Concussion": "Neurological",
    "Stroke": "Neurological",
    "Epilepsy": "Neurological",
    "Parkinson's Disease": "Neurological",
    "Multiple Sclerosis": "Neurological",
    "Depression": "Mental Health",
    "Anxiety": "Mental Health",
    "Panic Disorder": "Mental Health",
    "Bipolar Disorder": "Mental Health",
    "Schizophrenia": "Mental Health",
    "Obsessive Compulsive Disorder (OCD)": "Mental Health",
    "Post-traumatic stress disorder (PTSD)": "Mental Health",
    "Gastritis": "Digestive",
    "Gastroesophageal Reflux Disease (GERD)": "Digestive",
    "Indigestion": "Digestive",
    "Appendicitis": "Digestive",
    "Irritable Bowel Syndrome": "Digestive",
    "Infectious Gastroenteritis": "Digestive",
    "Crohn's Disease": "Digestive",
    "Ulcerative Colitis": "Digestive",
    "Liver Disease": "Digestive",
    "Hepatitis": "Digestive",
    "Acne": "Skin",
    "Eczema": "Skin",
    "Psoriasis": "Skin",
    "Contact Dermatitis": "Skin",
    "Fungal Infection of the Skin": "Skin",
    "Scabies": "Skin",
    "Rosacea": "Skin",
    "Impetigo": "Skin",
    "Skin Rash": "Skin",
    "Dengue Fever": "Infectious",
    "Malaria": "Infectious",
    "Typhoid Fever": "Infectious",
    "Chickenpox": "Infectious",
    "Shingles (Herpes Zoster)": "Infectious",
    "Viral Warts": "Infectious",
    "Cold Sore": "Infectious",
    "Urinary Tract Infection": "Urinary",
    "Kidney Stones": "Urinary",
    "Chronic Kidney Disease": "Urinary",
    "Osteoarthritis": "Musculoskeletal",
    "Rheumatoid Arthritis": "Musculoskeletal",
    "Chronic Back Pain": "Musculoskeletal",
    "Muscle Spasm": "Musculoskeletal",
    "Sciatica": "Musculoskeletal",
    "Sprain or Strain": "Musculoskeletal",
    "Tendinitis": "Musculoskeletal",
    "Diabetes": "Endocrine",
    "Hypoglycemia": "Endocrine",
    "Hypothyroidism": "Endocrine",
    "Hyperthyroidism": "Endocrine",
    "Thyroid Disease": "Endocrine",
    "Conjunctivitis": "Eyes",
    "Dry Eye of Unknown Cause": "Eyes",
    "Glaucoma": "Eyes",
    "Cataract": "Eyes",
    "Anemia": "Hematological",
    "Iron Deficiency Anaemia": "Hematological",
    "Vitamin D Deficiency": "Musculoskeletal",
}

DISEASE_SPECIALIST: Dict[str, str] = {
    "Asthma": "Pulmonologist",
    "Pneumonia": "Pulmonologist",
    "Bronchitis": "Pulmonologist",
    "Tuberculosis": "Pulmonologist",
    "Acute sinusitis": "ENT Specialist",
    "Chronic sinusitis": "ENT Specialist",
    "Angina": "Cardiologist",
    "Heart Attack": "Cardiologist",
    "Hypertension": "Cardiologist",
    "Coronary Artery Disease": "Cardiologist",
    "Heart Failure": "Cardiologist",
    "Migraine": "Neurologist",
    "Stroke": "Neurologist",
    "Epilepsy": "Neurologist",
    "Parkinson's Disease": "Neurologist",
    "Depression": "Psychiatrist",
    "Anxiety": "Psychiatrist",
    "Panic Disorder": "Psychiatrist",
    "Bipolar Disorder": "Psychiatrist",
    "Schizophrenia": "Psychiatrist",
    "Gastritis": "Gastroenterologist",
    "Irritable Bowel Syndrome": "Gastroenterologist",
    "Crohn's Disease": "Gastroenterologist",
    "Appendicitis": "General Surgeon",
    "Infectious Gastroenteritis": "Gastroenterologist",
    "Liver Disease": "Hepatologist",
    "Hepatitis": "Hepatologist",
    "Acne": "Dermatologist",
    "Eczema": "Dermatologist",
    "Psoriasis": "Dermatologist",
    "Contact Dermatitis": "Dermatologist",
    "Dengue Fever": "Internal Medicine",
    "Malaria": "Internal Medicine",
    "Typhoid Fever": "Internal Medicine",
    "Urinary Tract Infection": "Urologist",
    "Kidney Stones": "Urologist",
    "Chronic Kidney Disease": "Nephrologist",
    "Osteoarthritis": "Orthopedist",
    "Rheumatoid Arthritis": "Rheumatologist",
    "Diabetes": "Endocrinologist",
    "Hypothyroidism": "Endocrinologist",
    "Hyperthyroidism": "Endocrinologist",
    "Conjunctivitis": "Ophthalmologist",
    "Glaucoma": "Ophthalmologist",
    "Anemia": "Hematologist",
}

# Fallback: body system → specialist
_SYSTEM_SPECIALIST: Dict[str, str] = {
    "Respiratory":     "Pulmonologist",
    "Cardiovascular":  "Cardiologist",
    "Neurological":    "Neurologist",
    "Digestive":       "Gastroenterologist",
    "Endocrine":       "Endocrinologist",
    "Urinary":         "Urologist",
    "Skin":            "Dermatologist",
    "Mental Health":   "Psychiatrist",
    "Musculoskeletal": "Orthopedist",
    "Hematological":   "Hematologist",
    "Infectious":      "Internal Medicine",
    "Eyes":            "Ophthalmologist",
    "General":         "General Physician",
}


def _infer_body_system(disease: str) -> str:
    """Keyword-based body system inference for diseases not in the lookup dict."""
    d = disease.lower()
    if any(k in d for k in ["lung", "bronch", "pneum", "asthma", "cough", "respir", "sinus", "tonsil", "laryngi", "influenza"]):
        return "Respiratory"
    if any(k in d for k in ["heart", "cardio", "angina", "hypertens", "atrial", "arrhythm", "coronary"]):
        return "Cardiovascular"
    if any(k in d for k in ["brain", "neuro", "headache", "migraine", "seizure", "stroke", "epilep", "concuss", "parkinson", "sclerosis"]):
        return "Neurological"
    if any(k in d for k in ["gastro", "stomach", "bowel", "intestin", "liver", "gerd", "digest", "colon", "hepat", "ulcer", "colitis"]):
        return "Digestive"
    if any(k in d for k in ["diabet", "thyroid", "endocrin", "insulin", "glucose", "hormonal", "hypoglycemia"]):
        return "Endocrine"
    if any(k in d for k in ["urin", "kidney", "bladder", "renal", "nephro"]):
        return "Urinary"
    if any(k in d for k in ["skin", "dermat", "rash", "eczema", "acne", "psoria", "itching", "impetigo"]):
        return "Skin"
    if any(k in d for k in ["anxiety", "depress", "mental", "psych", "panic", "bipolar", "ocd", "ptsd", "schiz"]):
        return "Mental Health"
    if any(k in d for k in ["joint", "bone", "muscle", "arthr", "ortho", "sprain", "tendin", "sciatica"]):
        return "Musculoskeletal"
    if any(k in d for k in ["blood", "anemia", "hemato", "lymph"]):
        return "Hematological"
    if any(k in d for k in ["infect", "virus", "bacter", "dengue", "malaria", "fever", "chickenpox", "herpes", "typhoid"]):
        return "Infectious"
    if any(k in d for k in ["eye", "vision", "conjunct", "ophthal", "glaucoma", "cataract"]):
        return "Eyes"
    return "General"


def get_body_system(disease: str) -> str:
    return DISEASE_BODY_SYSTEM.get(disease) or _infer_body_system(disease)


def get_specialist(disease: str, body_system: str) -> str:
    return (
        DISEASE_SPECIALIST.get(disease)
        or _SYSTEM_SPECIALIST.get(body_system, "General Physician")
    )


# ── Main predictor class ───────────────────────────────────────────────────────
class NBPredictor:
    """
    Loads the trained Multinomial Naive Bayes model and provides
    selection-based symptom-to-disease prediction.
    """

    def __init__(self):
        model_path    = os.path.join(_MODELS, "mnb.pkl")
        features_path = os.path.join(_MODELS, "features.pkl")
        le_path       = os.path.join(_MODELS, "label_encoder.pkl")

        missing = [p for p in (model_path, features_path, le_path) if not os.path.exists(p)]
        if missing:
            raise FileNotFoundError(
                f"NB model files missing from saved_models/: {[os.path.basename(p) for p in missing]}"
            )

        self.model: Any       = joblib.load(model_path)
        self.features: list   = joblib.load(features_path)
        self.le: Any          = joblib.load(le_path)
        # Normalised once for O(1) lookup
        self._clean: list     = [str(f).lower().strip() for f in self.features]
        logger.info(
            "✅ NBPredictor: %d features, %d disease classes",
            len(self.features), len(self.le.classes_),
        )

    # ── Public helpers ─────────────────────────────────────────────────────────

    def get_symptom_list(self) -> List[str]:
        """Return the canonical 377-feature symptom list (excludes 'diseases' header)."""
        return [
            str(f) for f in self.features
            if str(f).lower().strip() not in ("", "diseases")
        ]

    def predict(self, symptoms: List[str], top_n: int = 6) -> Dict[str, Any]:
        """
        Build binary feature vector and return top-N disease predictions.

        Args:
            symptoms:  List of symptom strings (from the canonical list).
            top_n:     Maximum number of top diseases to return.

        Returns:
            {
              "type":             "multiple" | "single" | "insufficient_data",
              "diseases":         [{"name": str, "probability": float}, ...],
              "matched_symptoms": [str, ...],   # recognised features
              "unmatched":        [str, ...],   # unrecognised inputs
            }
        """
        input_vector          = [0] * len(self.features)
        matched:   List[str]  = []
        unmatched: List[str]  = []

        for sym in symptoms:
            key = sym.lower().strip()
            if key in self._clean:
                idx = self._clean.index(key)
                input_vector[idx] = 1
                canonical = str(self.features[idx])
                if canonical not in matched:
                    matched.append(canonical)
            else:
                unmatched.append(sym)

        if sum(input_vector) == 0:
            return {
                "type":             "insufficient_data",
                "diseases":         [],
                "matched_symptoms": [],
                "unmatched":        symptoms,
            }

        probs       = self.model.predict_proba([input_vector])[0]
        top_indices = np.argsort(probs)[::-1][:top_n]

        diseases: List[Dict[str, Any]] = []
        for idx in top_indices:
            prob = float(probs[idx])
            if prob < 0.005:         # skip near-zero probabilities
                break
            name = str(self.le.inverse_transform([idx])[0])
            diseases.append({"name": name, "probability": round(prob, 4)})

        return {
            "type":             "single" if len(diseases) <= 1 else "multiple",
            "diseases":         diseases,
            "matched_symptoms": matched,
            "unmatched":        unmatched,
        }
