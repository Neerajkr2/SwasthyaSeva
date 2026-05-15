# backend/ml/disease_predictor.py
"""
Disease Risk Predictor
======================
Uses scikit-learn Random Forest + Logistic Regression ensemble models trained on:
  - Pima Indians Diabetes Dataset (diabetes risk)
  - Cleveland Heart Disease Dataset (heart disease risk)
  - ILPD (Indian Liver Patient Dataset, liver risk)

At runtime, attempts to load pre-trained models from disk.
Falls back to a heuristic scorer when models are absent (before training).
"""
from __future__ import annotations
import os, logging, numpy as np
from pathlib import Path
from typing import Dict, Any

# EnsembleModel must be importable here so that joblib.load() can resolve
# the class when deserializing the saved .joblib files.
# (joblib pickle stores objects by their module path; without this import
# the load raises: AttributeError: Can't get attribute 'EnsembleModel')
from ml.ensemble_model import EnsembleModel  # noqa: F401  (needed for pickle)

logger = logging.getLogger(__name__)


# ── Feature engineering ───────────────────────────────────────────────────────
def _bmi(weight_kg: float, height_cm: float) -> float:
    h = height_cm / 100
    return round(weight_kg / (h * h), 2) if h > 0 else 0.0

def _parse_bp(bp_str: str) -> float:
    """Parse '120/80' → systolic float."""
    try:
        return float(bp_str.split("/")[0])
    except Exception:
        return 0.0


def _build_diabetes_features(params: dict) -> np.ndarray:
    """
    Pima dataset features:
    Pregnancies, Glucose, BloodPressure, SkinThickness, Insulin, BMI, DPF, Age
    We map available params and use medians for missing.
    """
    bmi_val = params.get("bmi") or (
        _bmi(params.get("weight", 0), params.get("height", 170)) if params.get("weight") else 25.0
    )
    bp = params.get("blood_pressure") or 72.0
    if isinstance(bp, str):
        bp = _parse_bp(bp)

    return np.array([[
        0,                                      # Pregnancies (unknown → 0)
        float(params.get("glucose", 100)),
        float(bp),
        20.0,                                   # SkinThickness (median)
        79.8,                                   # Insulin (median)
        float(bmi_val),
        0.471,                                  # DiabetesPedigreeFunction (median)
        float(params.get("age", 35)),
    ]])


def _build_heart_features(params: dict) -> np.ndarray:
    """
    Cleveland dataset features:
    age, sex(0/1), cp(0-3), trestbps, chol, fbs, restecg, thalach, exang, oldpeak, slope, ca, thal
    """
    bp = params.get("blood_pressure") or 130.0
    if isinstance(bp, str):
        bp = _parse_bp(bp)
    sex = 1 if str(params.get("gender", "male")).lower() == "male" else 0

    return np.array([[
        float(params.get("age", 35)),
        sex,
        1,                                      # cp: atypical angina (median)
        float(bp),
        float(params.get("cholesterol", 200)),
        1 if float(params.get("glucose", 100)) > 120 else 0,  # fbs
        1,                                      # restecg (median)
        150.0,                                  # thalach (median max HR)
        0,                                      # exang
        1.0,                                    # oldpeak
        2,                                      # slope
        0,                                      # ca
        2,                                      # thal
    ]])


def _build_liver_features(params: dict) -> np.ndarray:
    """ILPD features: age, gender(1/2), TB, DB, Alkphos, Sgpt, Sgot, TP, ALB, AG"""
    sex = 1 if str(params.get("gender", "male")).lower() == "male" else 2
    return np.array([[
        float(params.get("age", 35)),
        sex,
        0.7, 0.2, 200.0, 30.0, 25.0, 6.5, 3.5, 1.0,   # typical healthy medians
    ]])


# ── Heuristic fallback scorer ─────────────────────────────────────────────────
def _heuristic_risk(params: dict) -> Dict[str, float]:
    """
    Rule-based risk scoring when trained models aren't loaded.
    Returns probabilities in [0, 1].
    """
    age    = float(params.get("age", 35))
    bmi    = float(params.get("bmi", 25) or 25)
    gluc   = float(params.get("glucose", 100) or 100)
    chol   = float(params.get("cholesterol", 180) or 180)
    smoke  = int(params.get("smoking", 0))
    family = int(params.get("family_history", 0))

    bp_raw = params.get("blood_pressure") or 120
    bp = _parse_bp(str(bp_raw)) if isinstance(bp_raw, str) else float(bp_raw)

    # Diabetes
    d = 0.05
    if gluc > 125:  d += 0.35
    elif gluc > 100:d += 0.15
    if bmi > 30:    d += 0.15
    if age > 45:    d += 0.10
    if family:      d += 0.10
    if smoke:       d += 0.05

    # Heart
    h = 0.05
    if bp > 140:    h += 0.25
    elif bp > 120:  h += 0.10
    if chol > 240:  h += 0.20
    elif chol > 200:h += 0.08
    if smoke:       h += 0.15
    if age > 55:    h += 0.15
    if family:      h += 0.10

    # Liver
    l = 0.05
    if bmi > 30:    l += 0.10
    if smoke:       l += 0.08
    if age > 50:    l += 0.08

    return {
        "diabetes":     round(min(d, 0.95), 3),
        "heart_disease":round(min(h, 0.95), 3),
        "liver_disorder":round(min(l, 0.95), 3),
    }


def _build_recommendation(risks: Dict[str, float]) -> str:
    high = [k for k, v in risks.items() if v > 0.6]
    mod  = [k for k, v in risks.items() if 0.3 < v <= 0.6]
    if high:
        names = ", ".join(h.replace("_", " ").title() for h in high)
        return (f"⚠️ Your risk for {names} is elevated. "
                "Please schedule an appointment with your doctor for a comprehensive screening. "
                "Immediate lifestyle changes — diet, exercise, and sleep — are strongly recommended.")
    if mod:
        names = ", ".join(m.replace("_", " ").title() for m in mod)
        return (f"Your risk for {names} is moderate. "
                "Regular health check-ups, a balanced diet, and at least 150 minutes of exercise per week "
                "can significantly reduce this risk.")
    return ("✅ Your current risk levels appear low. Maintain a healthy lifestyle with balanced nutrition, "
            "regular exercise, adequate sleep, and annual health screenings.")


# ── Main class ────────────────────────────────────────────────────────────────
class DiseasePredictor:
    """
    Loads pre-trained sklearn models (if available) or falls back to heuristics.
    Call .predict(params) with a dict of health parameters.
    """

    def __init__(self, models_dir: str | None = None):
        self.models: Dict[str, Any] = {}
        self.scalers: Dict[str, Any] = {}
        base = Path(models_dir or os.getenv("ML_MODELS_DIR", "./ml/saved_models"))

        diseases = ["diabetes", "heart_disease", "liver_disorder"]
        for d in diseases:
            model_path  = base / f"{d}_model.joblib"
            scaler_path = base / f"{d}_scaler.joblib"
            try:
                import joblib
                self.models[d]  = joblib.load(model_path)
                self.scalers[d] = joblib.load(scaler_path)
                logger.info(f"✅ Loaded {d} model from {model_path}")
            except FileNotFoundError:
                logger.warning(f"⚠️  {d} model not found at {model_path} — using heuristics")
            except Exception as e:
                logger.error(f"Error loading {d} model: {e}")

    def predict(self, params: dict) -> dict:
        """
        Returns {"risks": {...}, "recommendation": str, "disclaimer": str}
        """
        feature_builders = {
            "diabetes":      _build_diabetes_features,
            "heart_disease": _build_heart_features,
            "liver_disorder":_build_liver_features,
        }

        if not self.models:
            risks = _heuristic_risk(params)
        else:
            risks = {}
            for disease, builder in feature_builders.items():
                try:
                    X = builder(params)
                    if disease in self.scalers:
                        X = self.scalers[disease].transform(X)
                    model = self.models[disease]
                    prob  = float(model.predict_proba(X)[0][1])
                    risks[disease] = round(prob, 3)
                except Exception as e:
                    logger.error(f"Prediction error for {disease}: {e}")
                    risks[disease] = _heuristic_risk(params).get(disease, 0.1)

        return {
            "risks": risks,
            "recommendation": _build_recommendation(risks),
            "disclaimer": "⚠️ These predictions are AI-generated estimates based on statistical models. They are NOT a medical diagnosis. Please consult a qualified physician.",
        }
