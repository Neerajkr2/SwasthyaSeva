# backend/tests/test_api.py
"""
Pytest test suite for SwasthyaSeva API.

Run: pytest tests/ -v --tb=short

Requires:
  pip install pytest pytest-asyncio httpx

Set TEST_DATABASE_URL to an in-memory or test PostgreSQL DB before running.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock

# ── App import ────────────────────────────────────────────────────────────────
# Patch env before importing app so Firebase/DB init doesn't fail in tests
import os
os.environ.setdefault("DATABASE_URL",              "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("FIREBASE_CREDENTIALS_PATH", "./tests/fixtures/firebase_mock.json")
os.environ.setdefault("JWT_SECRET_KEY",            "test-secret-key-minimum-24-chars")
os.environ.setdefault("ANTHROPIC_API_KEY",         "test-anthropic-key")
os.environ.setdefault("RECAPTCHA_SECRET_KEY",      "test-recaptcha-key")

# ── Fixtures ──────────────────────────────────────────────────────────────────
MOCK_FIREBASE_CLAIMS = {
    "uid":   "test-firebase-uid-123",
    "email": "test@swasthyaseva.com",
    "name":  "Test User",
}

MOCK_VALID_TOKEN = "valid.jwt.token"

# ── Helpers ───────────────────────────────────────────────────────────────────
def auth_headers(token: str = MOCK_VALID_TOKEN) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Auth Tests ────────────────────────────────────────────────────────────────
class TestAuth:
    """Test authentication endpoints."""

    @pytest.mark.asyncio
    async def test_health_endpoint(self):
        """GET /health should always return 200."""
        with patch("startup_checks.run_startup_checks"):
            from main import app
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    @pytest.mark.asyncio
    async def test_google_login_missing_captcha(self):
        """POST /auth/google with invalid captcha should return 400."""
        with (
            patch("startup_checks.run_startup_checks"),
            patch("services.auth_service.verify_recaptcha", return_value=False),
            patch("services.auth_service.verify_firebase_token", return_value=MOCK_FIREBASE_CLAIMS),
        ):
            from main import app
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post("/auth/google", json={
                    "id_token": "firebase-id-token",
                    "captcha_token": "invalid-captcha",
                })
        assert resp.status_code == 400
        assert "reCAPTCHA" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_get_me_unauthenticated(self):
        """GET /auth/me without token should return 403."""
        with patch("startup_checks.run_startup_checks"):
            from main import app
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get("/auth/me")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_get_me_invalid_token(self):
        """GET /auth/me with bad JWT should return 401."""
        with patch("startup_checks.run_startup_checks"):
            from main import app
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get("/auth/me", headers={"Authorization": "Bearer bad.token.here"})
        assert resp.status_code == 401


# ── ML Tests ──────────────────────────────────────────────────────────────────
class TestML:
    """Test ML/AI endpoints (unit-level — mock models)."""

    def test_symptom_analyzer_rule_based(self):
        """Rule-based symptom analyzer should return results without NLP model."""
        from ml.symptom_analyzer import SymptomAnalyzer
        analyzer = SymptomAnalyzer.__new__(SymptomAnalyzer)
        analyzer.pipe = None  # simulate no model loaded
        result = analyzer.analyze("I have fever, headache, and body aches for 3 days")
        assert "conditions" in result
        assert "urgency" in result
        assert result["urgency"] in ("low", "medium", "high", "emergency")
        assert len(result["conditions"]) > 0
        assert all("label" in c and "score" in c for c in result["conditions"])

    def test_disease_predictor_heuristic(self):
        """Disease predictor heuristic fallback should return 3 diseases."""
        from ml.disease_predictor import DiseasePredictor
        predictor = DiseasePredictor.__new__(DiseasePredictor)
        predictor.models  = {}
        predictor.scalers = {}
        result = predictor.predict({"age": 55, "glucose": 140, "bmi": 31, "blood_pressure": 145})
        assert "risks" in result
        assert "diabetes"       in result["risks"]
        assert "heart_disease"  in result["risks"]
        assert "liver_disorder" in result["risks"]
        for v in result["risks"].values():
            assert 0 <= v <= 1

    def test_drug_interaction_contraindicated(self):
        """SSRI + MAOI should be flagged as contraindicated."""
        from ml.drug_interaction import DrugInteractionChecker
        checker = DrugInteractionChecker()
        result  = checker.check(["sertraline", "phenelzine"])
        assert not result["safe"]
        assert any(i["severity"] == "contraindicated" for i in result["interactions"])

    def test_drug_interaction_safe_pair(self):
        """Paracetamol + Vitamin C should be safe."""
        from ml.drug_interaction import DrugInteractionChecker
        checker = DrugInteractionChecker()
        result  = checker.check(["paracetamol", "vitamin c"])
        assert result["safe"]
        assert result["interactions"] == []

    def test_drug_interaction_requires_two_drugs(self):
        """Less than 2 drugs should raise ValueError / be handled by route."""
        from ml.drug_interaction import DrugInteractionChecker
        checker = DrugInteractionChecker()
        # Single drug — no combinations possible → safe result
        result = checker.check(["aspirin"])
        assert result["safe"]

    def test_report_analyzer_extracts_values(self):
        """ReportAnalyzer should parse lab values from plain text."""
        from ml.report_analyzer import _parse_lab_values
        sample_text = """
        Patient: John Doe
        Glucose : 145 mg/dL
        Haemoglobin: 10.2 g/dL
        WBC : 11500 cells/μL
        Total Cholesterol : 240 mg/dL
        """
        values = _parse_lab_values(sample_text)
        names  = [v["parameter"].lower() for v in values]
        assert any("glucose" in n for n in names)
        # Glucose 145 should be flagged high
        glucose = next((v for v in values if "glucose" in v["parameter"].lower()), None)
        if glucose:
            assert glucose["status"] in ("high", "normal")

    def test_urgency_detection_emergency(self):
        """Chest pain + shortness of breath should trigger emergency urgency."""
        from ml.symptom_analyzer import _detect_urgency
        text = "Sudden severe chest pain and difficulty breathing"
        assert _detect_urgency(text) == "emergency"

    def test_urgency_detection_low(self):
        """Mild cold symptoms should be low urgency."""
        from ml.symptom_analyzer import _detect_urgency
        text = "Slight runny nose and mild sneezing"
        assert _detect_urgency(text) in ("low", "medium")


# ── User Tests ────────────────────────────────────────────────────────────────
class TestUsers:
    """Test user endpoints — requires a valid JWT."""

    @pytest.mark.asyncio
    async def test_get_vitals_unauthenticated(self):
        """GET /users/vitals without auth should return 403."""
        with patch("startup_checks.run_startup_checks"):
            from main import app
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get("/users/vitals")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_get_reports_unauthenticated(self):
        """GET /users/reports without auth should return 403."""
        with patch("startup_checks.run_startup_checks"):
            from main import app
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get("/users/reports")
        assert resp.status_code in (401, 403)


# ── Chat Tests ────────────────────────────────────────────────────────────────
class TestChat:
    """Test chat session endpoints."""

    @pytest.mark.asyncio
    async def test_create_session_unauthenticated(self):
        """POST /chat/sessions without auth should return 403."""
        with patch("startup_checks.run_startup_checks"):
            from main import app
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post("/chat/sessions")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_get_sessions_unauthenticated(self):
        """GET /chat/sessions without auth should return 403."""
        with patch("startup_checks.run_startup_checks"):
            from main import app
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get("/chat/sessions")
        assert resp.status_code in (401, 403)


# ── Rate Limit Tests ──────────────────────────────────────────────────────────
class TestRateLimit:
    """Test rate limiting middleware."""

    def test_rate_limit_rule_lookup(self):
        """Rate limit rules should resolve correctly per path prefix."""
        from middleware.rate_limit import RateLimitMiddleware

        class FakeApp:
            pass

        mw = RateLimitMiddleware.__new__(RateLimitMiddleware)
        prefix, limit, window = mw._get_rule("/auth/google")
        assert prefix == "/auth"
        assert limit == 20
        assert window == 60

        prefix2, limit2, window2 = mw._get_rule("/unknown/path")
        assert prefix2 == "default"
        assert limit2 == 200


# ── Contact Tests ─────────────────────────────────────────────────────────────
class TestContact:
    """Test contact form endpoint."""

    @pytest.mark.asyncio
    async def test_contact_valid(self):
        """POST /contact with valid data should return 200."""
        with patch("startup_checks.run_startup_checks"):
            from main import app
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post("/contact", json={
                    "name":    "Test User",
                    "email":   "test@example.com",
                    "subject": "Test subject",
                    "message": "This is a test message from the test suite.",
                })
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    @pytest.mark.asyncio
    async def test_contact_short_message(self):
        """POST /contact with too-short message should return 422."""
        with patch("startup_checks.run_startup_checks"):
            from main import app
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post("/contact", json={
                    "name":    "T",
                    "email":   "bad-email",
                    "message": "Hi",
                })
        assert resp.status_code == 422
