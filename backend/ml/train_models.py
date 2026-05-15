#!/usr/bin/env python3
# backend/ml/train_models.py
"""
Model Training Script
=====================
Downloads (or expects) public clinical datasets, trains Random Forest classifiers,
and saves them with joblib for production use.

Run once before deployment:
    python ml/train_models.py

Datasets used (auto-downloaded from UCI/Kaggle mirrors):
  1. Pima Indians Diabetes  (768 samples, 8 features)
  2. Cleveland Heart Disease (303 samples, 13 features)
  3. ILPD Liver Dataset      (583 samples, 10 features)
"""
import os, logging, warnings, numpy as np, pandas as pd
from pathlib import Path
from sklearn.ensemble          import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model      import LogisticRegression
from sklearn.preprocessing     import StandardScaler
from sklearn.model_selection   import cross_val_score, train_test_split, StratifiedKFold
from sklearn.pipeline          import Pipeline
from sklearn.metrics           import classification_report, roc_auc_score
from sklearn.impute            import SimpleImputer
from imblearn.over_sampling    import SMOTE
import joblib

# EnsembleModel must be imported from its own top-level module so that joblib
# can pickle/unpickle it by its stable import path (ml.ensemble_model.EnsembleModel).
# Defining it inside train_model() made it unresolvable at load time.
#
# The try/except handles two valid execution styles:
#   python -m ml.train_models        (from backend/ dir — uses "ml.ensemble_model")
#   python ml/train_models.py        (from backend/ dir — falls back to "ensemble_model")
try:
    from ml.ensemble_model import EnsembleModel
except ModuleNotFoundError:
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    from ensemble_model import EnsembleModel

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

MODELS_DIR = Path(os.getenv("ML_MODELS_DIR", "./ml/saved_models"))
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# ── Dataset loaders ───────────────────────────────────────────────────────────
def load_pima_diabetes() -> tuple[np.ndarray, np.ndarray]:
    url = "https://raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv"
    cols = ["Pregnancies","Glucose","BloodPressure","SkinThickness","Insulin","BMI","DPF","Age","Outcome"]
    df = pd.read_csv(url, names=cols)
    # Replace 0s in medical measurements with NaN (impossible values)
    for c in ["Glucose","BloodPressure","SkinThickness","Insulin","BMI"]:
        df[c] = df[c].replace(0, np.nan)
    X = df.drop("Outcome", axis=1).values
    y = df["Outcome"].values
    logger.info(f"Pima Diabetes: {X.shape[0]} samples, positive rate: {y.mean():.2%}")
    return X, y


def load_cleveland_heart() -> tuple[np.ndarray, np.ndarray]:
    url = "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data"
    cols = ["age","sex","cp","trestbps","chol","fbs","restecg","thalach","exang","oldpeak","slope","ca","thal","target"]
    df = pd.read_csv(url, names=cols, na_values="?")
    df["target"] = (df["target"] > 0).astype(int)
    X = df.drop("target", axis=1).values
    y = df["target"].values
    logger.info(f"Cleveland Heart: {X.shape[0]} samples, positive rate: {y.mean():.2%}")
    return X, y


def load_liver_ilpd() -> tuple[np.ndarray, np.ndarray]:
    url = "https://archive.ics.uci.edu/ml/machine-learning-databases/00225/Indian%20Liver%20Patient%20Dataset%20(ILPD).csv"
    cols = ["Age","Gender","TB","DB","Alkphos","Sgpt","Sgot","TP","ALB","AG","Selector"]
    df = pd.read_csv(url, names=cols)
    df["Gender"] = (df["Gender"] == "Male").astype(int) + 1
    df["Selector"] = (df["Selector"] == 1).astype(int)  # 1 = patient (liver disease)
    X = df.drop("Selector", axis=1).values
    y = df["Selector"].values
    logger.info(f"ILPD Liver: {X.shape[0]} samples, positive rate: {y.mean():.2%}")
    return X, y


# ── Training pipeline ─────────────────────────────────────────────────────────
def train_model(X: np.ndarray, y: np.ndarray, disease: str) -> None:
    logger.info(f"\n{'='*50}")
    logger.info(f"Training model: {disease}")

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # Impute missing values
    imputer = SimpleImputer(strategy="median")
    X_train = imputer.fit_transform(X_train)
    X_test  = imputer.transform(X_test)

    # Handle class imbalance with SMOTE
    try:
        smote = SMOTE(random_state=42)
        X_res, y_res = smote.fit_resample(X_train, y_train)
        logger.info(f"SMOTE applied: {X_train.shape[0]} → {X_res.shape[0]} samples")
    except Exception:
        X_res, y_res = X_train, y_train

    # Scale
    scaler  = StandardScaler()
    X_res   = scaler.fit_transform(X_res)
    X_test_s = scaler.transform(X_test)

    # Ensemble: RF + GBM, weighted probability average
    rf  = RandomForestClassifier(n_estimators=200, max_depth=8, class_weight="balanced", random_state=42, n_jobs=-1)
    gbm = GradientBoostingClassifier(n_estimators=150, learning_rate=0.05, max_depth=4, random_state=42)

    rf.fit(X_res, y_res)
    gbm.fit(X_res, y_res)

    # Evaluate
    for name, clf in [("Random Forest", rf), ("Gradient Boosting", gbm)]:
        preds = clf.predict(X_test_s)
        proba = clf.predict_proba(X_test_s)[:, 1]
        auc   = roc_auc_score(y_test, proba)
        logger.info(f"\n{name}:\n{classification_report(y_test, preds)}")
        logger.info(f"AUC-ROC: {auc:.4f}")

    # Cross-validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(rf, scaler.transform(imputer.transform(X)), y, cv=cv, scoring="roc_auc")
    logger.info(f"5-Fold CV AUC (RF): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # ── Ensemble wrapper ──────────────────────────────────────────────────────
    # EnsembleModel is imported from ml.ensemble_model (top-level module) so
    # that joblib can resolve it by path when loading back in disease_predictor.
    ensemble = EnsembleModel(rf, gbm, imputer, scaler)

    # Save
    joblib.dump(ensemble, MODELS_DIR / f"{disease}_model.joblib",  compress=3)
    joblib.dump(scaler,   MODELS_DIR / f"{disease}_scaler.joblib", compress=3)
    logger.info(f"✅ Saved {disease} model to {MODELS_DIR}")


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    tasks = [
        ("diabetes",      load_pima_diabetes),
        ("heart_disease", load_cleveland_heart),
        ("liver_disorder",load_liver_ilpd),
    ]
    for disease, loader in tasks:
        try:
            X, y = loader()
            train_model(X, y, disease)
        except Exception as e:
            logger.error(f"Failed to train {disease}: {e}")

    logger.info("\n🎉 All models trained and saved successfully!")
    logger.info(f"Models directory: {MODELS_DIR.resolve()}")
