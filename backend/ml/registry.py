# backend/ml/registry.py
"""
Lazy, cached accessors for the ML models and the RAG retriever.

Why this exists
---------------
Previously every model was instantiated synchronously inside the FastAPI
lifespan (startup). On a small free-tier instance that made cold starts slow
and held all models in memory before the app could even answer /health.

These accessors load each model on FIRST USE instead, and cache the instance
on ``app.state``. The result:

  • startup is fast — the process binds the port and answers /health quickly,
  • memory is only spent on the models actually exercised,
  • optional models (NBPredictor / RAG retriever) degrade gracefully if their
    files are missing instead of taking the whole app down.

Every getter is cheap to call on each request: after the first call it simply
returns the cached instance.
"""
import logging

logger = logging.getLogger(__name__)

# Sentinel stored on app.state to mark "we tried to load this optional model
# and it failed — don't keep retrying (and re-logging) on every request".
_FAILED = object()


def get_disease_predictor(app):
    obj = getattr(app.state, "disease_predictor", None)
    if obj is None:
        from ml.disease_predictor import DiseasePredictor
        logger.info("⏳ Lazy-loading DiseasePredictor…")
        obj = DiseasePredictor()
        app.state.disease_predictor = obj
        logger.info("✅ DiseasePredictor ready")
    return obj


def get_symptom_analyzer(app):
    obj = getattr(app.state, "symptom_analyzer", None)
    if obj is None:
        from ml.symptom_analyzer import SymptomAnalyzer
        logger.info("⏳ Lazy-loading SymptomAnalyzer…")
        obj = SymptomAnalyzer()
        app.state.symptom_analyzer = obj
        logger.info("✅ SymptomAnalyzer ready")
    return obj


def get_drug_checker(app):
    obj = getattr(app.state, "drug_checker", None)
    if obj is None:
        from ml.drug_interaction import DrugInteractionChecker
        logger.info("⏳ Lazy-loading DrugInteractionChecker…")
        obj = DrugInteractionChecker()
        app.state.drug_checker = obj
        logger.info("✅ DrugInteractionChecker ready")
    return obj


def get_nb_predictor(app):
    """Optional model — returns None if its files are missing (callers 503)."""
    obj = getattr(app.state, "nb_predictor", None)
    if obj is _FAILED:
        return None
    if obj is None:
        try:
            from ml.nb_predictor import NBPredictor
            logger.info("⏳ Lazy-loading NBPredictor…")
            obj = NBPredictor()
            app.state.nb_predictor = obj
            logger.info("✅ NBPredictor ready")
        except FileNotFoundError as exc:
            logger.warning("⚠️  NBPredictor unavailable (%s) — /ml/symptoms/select will 503", exc)
            app.state.nb_predictor = _FAILED
            return None
    return obj


def get_knowledge_retriever(app):
    """Optional RAG retriever — returns None if it can't build (chat runs without RAG)."""
    obj = getattr(app.state, "knowledge_retriever", None)
    if obj is _FAILED:
        return None
    if obj is None:
        try:
            from services.rag_service import HealthcareKnowledgeRetriever
            logger.info("⏳ Lazy-loading Healthcare Knowledge Retriever…")
            obj = HealthcareKnowledgeRetriever()
            app.state.knowledge_retriever = obj
            logger.info("✅ Knowledge Retriever ready (%d articles)", obj.article_count())
        except Exception as exc:
            logger.warning("⚠️  Knowledge Retriever unavailable (%s) — chat will run without RAG", exc)
            app.state.knowledge_retriever = _FAILED
            return None
    return obj
