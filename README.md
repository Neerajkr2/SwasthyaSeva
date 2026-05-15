# SwasthyaSeva — AI-Powered Healthcare Intelligence Platform

> Full-stack React + FastAPI + PostgreSQL + ML platform for symptom analysis,
> medical report interpretation, disease risk prediction, and drug interaction checking.

---

## Architecture

```
swasthyaseva/
├── frontend/                    # React 18 + Vite + TailwindCSS
│   └── src/
│       ├── components/
│       │   ├── auth/            # AuthModal, LoginForm, SignupForm, GoogleButton
│       │   ├── chat/            # ChatSidebar, MessageArea, ChatInput, QuickActions
│       │   ├── common/          # Navbar, LoadingSpinner
│       │   ├── dashboard/       # DashboardSidebar, all dashboard widgets
│       │   └── landing/         # Hero, HowItWorks, Features, Sections (Pricing etc.)
│       ├── context/             # AuthContext, ToastContext
│       ├── hooks/               # useAuth, useChat
│       ├── pages/               # LandingPage, DashboardPage, ChatPage
│       └── services/            # firebase.js, api.js (axios)
│
├── backend/                     # FastAPI + SQLAlchemy (async) + PostgreSQL
│   ├── main.py                  # App entry, CORS, lifespan
│   ├── config.py                # Pydantic settings from .env
│   ├── database.py              # Async SQLAlchemy engine + Base
│   ├── models/                  # User, UserVitals, ChatSession, ChatMessage, MedicalReport
│   ├── schemas/                 # Pydantic request/response models
│   ├── routes/
│   │   ├── auth.py              # Google + Email auth with Firebase + reCAPTCHA
│   │   ├── chat.py              # Sessions CRUD + Claude AI message handler
│   │   ├── users.py             # Vitals, reports, dashboard stats
│   │   └── ml.py                # All 4 ML/AI endpoints
│   ├── services/
│   │   ├── auth_service.py      # Firebase verify, reCAPTCHA, JWT
│   │   └── claude_service.py    # Anthropic Claude API wrapper
│   └── ml/
│       ├── disease_predictor.py # RF + GBM ensemble (diabetes/heart/liver)
│       ├── symptom_analyzer.py  # HuggingFace zero-shot NLP
│       ├── drug_interaction.py  # Rule-engine + 20-entry interaction DB
│       ├── report_analyzer.py   # Tesseract OCR + lab value parser
│       └── train_models.py      # Training script (run once before deployment)
│
└── docker-compose.yml           # Full stack orchestration
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| Python | ≥ 3.11 |
| PostgreSQL | ≥ 15 |
| Tesseract OCR | ≥ 5 |
| Docker + Compose | Any recent |

---

## 1. Third-party Setup (Required)

### Firebase
1. Go to [Firebase Console](https://console.firebase.google.com) → Create project
2. Enable **Authentication** → Sign-in methods → **Email/Password** ✅ and **Google** ✅
3. In Project Settings → Service Accounts → **Generate new private key** → save as `backend/firebase-credentials.json`
4. In Project Settings → General → copy Web App config values for frontend `.env`

### Google reCAPTCHA v2
1. Go to [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Register site → **reCAPTCHA v2** → "I'm not a robot" Checkbox
3. Add domains: `localhost` for dev, your domain for production
4. Copy **Site Key** → frontend `.env`, **Secret Key** → backend `.env`

### Anthropic API
1. Visit [console.anthropic.com](https://console.anthropic.com) → API Keys → Create
2. Add to `backend/.env` as `ANTHROPIC_API_KEY`

---

## 2. Environment Files

### Frontend — `frontend/.env`
```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_RECAPTCHA_SITE_KEY=6Lc...
VITE_API_BASE_URL=http://localhost:8000
```

### Backend — `backend/.env`
```
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/swasthyaseva
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
JWT_SECRET_KEY=your-super-secret-key-min-32-chars
ANTHROPIC_API_KEY=sk-ant-...
RECAPTCHA_SECRET_KEY=6Lc...
ML_MODELS_DIR=./ml/saved_models
ALLOWED_ORIGINS=http://localhost:3000
```

---

## 3. Local Development (without Docker)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Install system deps (Ubuntu/Debian)
sudo apt-get install tesseract-ocr poppler-utils

# Train ML models (downloads datasets, ~5 min)
python ml/train_models.py

# Start API
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # → http://localhost:3000
```

---

## Start Both Servers

```bash
# Backend
cd backend 
venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
```

---
---

## 4. Docker Compose (Recommended)

```bash
# Copy and fill env files
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
# → fill all values

# Copy Firebase credentials
cp ~/Downloads/firebase-key.json backend/firebase-credentials.json

# Start everything
docker compose up --build

# Train ML models (first time only)
docker compose exec backend python ml/train_models.py
```

---

## 5. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/google` | — | Google sign-in with Firebase token + reCAPTCHA |
| POST | `/auth/register` | — | Email sign-up |
| POST | `/auth/login` | — | Email login |
| GET | `/auth/me` | JWT | Get current user |
| GET | `/users/vitals` | JWT | Get health vitals |
| PUT | `/users/vitals` | JWT | Update health vitals |
| GET | `/users/reports` | JWT | List uploaded reports |
| DELETE | `/users/reports/{id}` | JWT | Delete a report |
| GET | `/users/dashboard` | JWT | Dashboard stats + recent sessions |
| GET | `/chat/sessions` | JWT | List all chat sessions |
| POST | `/chat/sessions` | JWT | Create new session |
| GET | `/chat/sessions/{id}` | JWT | Get session with messages |
| DELETE | `/chat/sessions/{id}` | JWT | Delete session |
| POST | `/chat/message` | JWT | Send message + optional file |
| POST | `/ml/symptoms` | JWT | NLP symptom analysis |
| POST | `/ml/risk` | JWT | Disease risk prediction |
| POST | `/ml/drugs` | JWT | Drug interaction check |
| POST | `/ml/report` | JWT | OCR + AI report analysis |

---

## 6. ML Models

### Disease Predictor
- **Algorithm**: Random Forest + Gradient Boosting ensemble (0.6/0.4 weighted)
- **Training data**: Pima Diabetes (768), Cleveland Heart (303), ILPD Liver (583)
- **AUC-ROC**: ~0.82–0.87 across all three diseases
- **Fallback**: Heuristic rule-based scorer (no model file needed)

### Symptom Analyzer
- **Model**: `facebook/bart-large-mnli` zero-shot classification
- **Candidates**: 37 medical conditions
- **Fallback**: Keyword-rule engine (no GPU required)

### Drug Interaction Checker
- **Method**: Pairwise rule-engine with 20 curated interaction entries
- **Coverage**: Anticoagulants, SSRIs/MAOIs, statins, antihypertensives, antibiotics, CNS depressants, contraceptives, cardiac drugs

### Report Analyzer
- **OCR**: Tesseract + pdf2image + PyPDF2 (text PDF fallback)
- **Parser**: Regex lab-value extractor with 40+ reference ranges (CBC, lipids, liver, kidney, thyroid, electrolytes)
- **AI**: Claude claude-opus-4-6 for natural-language interpretation

---

## 7. Security Notes

- Firebase ID tokens verified server-side via Firebase Admin SDK
- reCAPTCHA verified against Google's siteverify API on every auth call
- App issues short-lived JWTs (7 days default, configurable)
- All database queries use parameterised SQLAlchemy (no raw SQL injection risk)
- File uploads: type + size validated before processing
- CORS locked to `ALLOWED_ORIGINS`

---

## 8. Production Deployment Checklist

- [ ] Set strong `JWT_SECRET_KEY` (min 32 random chars)
- [ ] Set `ENVIRONMENT=production` (disables SQL echo)
- [ ] Add production domain to Firebase authorized domains
- [ ] Add production domain to reCAPTCHA allowed domains
- [ ] Use managed PostgreSQL (RDS, Supabase, Neon)
- [ ] Store `firebase-credentials.json` as a secret (not in version control)
- [ ] Enable HTTPS on frontend + backend
- [ ] Set `ALLOWED_ORIGINS` to production domain only
- [ ] Run `python ml/train_models.py` once during deployment
