# backend/ml/ensemble_model.py
"""
EnsembleModel — top-level class so joblib can pickle/unpickle it correctly.

WHY THIS FILE EXISTS:
Previously EnsembleModel was defined *inside* the train_model() function in
train_models.py.  Python pickle stores every object by its module import path.
A class nested inside a function has the path:
    train_models.train_model.<locals>.EnsembleModel
which is unresolvable at load time (the class only exists while train_model()
is executing), so joblib.load() raises:

    AttributeError: Can't get attribute 'EnsembleModel' on ...

Moving the class here gives it the stable, importable path:
    ml.ensemble_model.EnsembleModel

Both train_models.py (saves) and disease_predictor.py (loads) import from
this module so pickle always finds the class.
"""
from __future__ import annotations
import numpy as np


class EnsembleModel:
    """
    Weighted probability ensemble of RandomForest + GradientBoosting.

    Stores its own imputer and scaler so a single object handles the full
    inference pipeline: raw features → imputed → scaled → probabilities.
    """

    def __init__(self, rf, gbm, imputer, scaler, rf_weight: float = 0.6):
        self.rf        = rf
        self.gbm       = gbm
        self.imputer   = imputer
        self.scaler    = scaler
        self.rf_weight = rf_weight

    # ── Inference ─────────────────────────────────────────────────────────────

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        Xi    = self.imputer.transform(X)
        Xs    = self.scaler.transform(Xi)
        p_rf  = self.rf.predict_proba(Xs)
        p_gbm = self.gbm.predict_proba(Xs)
        return self.rf_weight * p_rf + (1 - self.rf_weight) * p_gbm

    def predict(self, X: np.ndarray) -> np.ndarray:
        return (self.predict_proba(X)[:, 1] >= 0.5).astype(int)
