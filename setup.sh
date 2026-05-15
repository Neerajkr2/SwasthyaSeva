#!/usr/bin/env bash
# ============================================================
# SwasthyaSeva — One-Command Setup Script
# Usage: chmod +x setup.sh && ./setup.sh
# ============================================================
set -euo pipefail
IFS=$'\n\t'

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

info()    { echo -e "${CYAN}▶  $*${NC}"; }
success() { echo -e "${GREEN}✅ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $*${NC}"; }
error()   { echo -e "${RED}❌ $*${NC}"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗"
echo -e "║     SwasthyaSeva — Setup & Installation      ║"
echo -e "╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check prerequisites ────────────────────────────────────────────────────
info "Checking prerequisites…"

command -v node  &>/dev/null || error "Node.js not found. Install from https://nodejs.org (v20+)"
command -v python3 &>/dev/null || error "Python 3 not found. Install from https://python.org (3.11+)"
command -v psql  &>/dev/null || warn "PostgreSQL client not found — DB may need manual setup"

NODE_VER=$(node -v | cut -d. -f1 | tr -d 'v')
PY_VER=$(python3 -c "import sys; print(sys.version_info.minor)")
[[ "$NODE_VER" -lt 18 ]] && error "Node.js v18+ required (found $(node -v))"
[[ "$PY_VER"   -lt 11 ]] && error "Python 3.11+ required"

success "Prerequisites OK (Node $(node -v), Python 3.${PY_VER})"

# ── 2. Environment files ──────────────────────────────────────────────────────
info "Setting up environment files…"

if [ ! -f frontend/.env ]; then
  cp frontend/.env.example frontend/.env
  warn "Created frontend/.env — FILL IN your Firebase and reCAPTCHA keys before running!"
fi

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  warn "Created backend/.env — FILL IN your API keys before running!"
fi

success "Environment files ready"

# ── 3. Firebase credentials placeholder ──────────────────────────────────────
if [ ! -f backend/firebase-credentials.json ]; then
  cat > backend/firebase-credentials.json << 'JSON'
{
  "__NOTE__": "Replace this file with your real Firebase service account JSON",
  "__HOWTO__": "Firebase Console → Project Settings → Service Accounts → Generate new private key",
  "type": "service_account",
  "project_id": "your-project-id"
}
JSON
  warn "Created placeholder backend/firebase-credentials.json — replace with real credentials!"
fi

# ── 4. Frontend dependencies ──────────────────────────────────────────────────
info "Installing frontend dependencies…"
cd frontend
npm install --silent
cd ..
success "Frontend dependencies installed"

# ── 5. Backend virtual environment ───────────────────────────────────────────
info "Setting up Python virtual environment…"
cd backend

if [ ! -d venv ]; then
  python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

# Install spaCy English model (small)
python -m spacy download en_core_web_sm --quiet 2>/dev/null || warn "spaCy model download failed — NLP fallback will be used"

cd ..
success "Backend dependencies installed"

# ── 6. System dependencies reminder ──────────────────────────────────────────
echo ""
info "System dependencies required (install manually if not present):"
echo "  Ubuntu/Debian:  sudo apt-get install tesseract-ocr poppler-utils"
echo "  macOS:          brew install tesseract poppler"
echo "  Windows:        https://github.com/tesseract-ocr/tesseract/wiki"

# ── 7. ML Model training ──────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}Train ML models now? (downloads ~5 MB of public datasets, takes ~5 minutes)${NC}"
read -r -p "Train models? [y/N]: " TRAIN_MODELS
if [[ "$TRAIN_MODELS" =~ ^[Yy]$ ]]; then
  info "Training ML models…"
  cd backend
  source venv/bin/activate
  python ml/train_models.py
  cd ..
  success "ML models trained and saved"
else
  warn "Skipping model training — heuristic fallbacks will be used until models are trained"
  info "Run later: cd backend && source venv/bin/activate && python ml/train_models.py"
fi

# ── 8. Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗"
echo -e "║              Setup Complete! 🎉                           ║"
echo -e "╠══════════════════════════════════════════════════════════╣"
echo -e "║  Before starting:                                         ║"
echo -e "║  1. Fill in frontend/.env with Firebase + reCAPTCHA keys ║"
echo -e "║  2. Fill in backend/.env  with API keys                   ║"
echo -e "║  3. Replace backend/firebase-credentials.json            ║"
echo -e "║  4. Start PostgreSQL and create database:                 ║"
echo -e "║     createdb swasthyaseva                                 ║"
echo -e "╠══════════════════════════════════════════════════════════╣"
echo -e "║  To start development:                                    ║"
echo -e "║  Terminal 1: cd backend && source venv/bin/activate       ║"
echo -e "║              uvicorn main:app --reload --port 8000        ║"
echo -e "║  Terminal 2: cd frontend && npm run dev                   ║"
echo -e "║                                                            ║"
echo -e "║  Or with Docker:  docker compose up --build               ║"
echo -e "╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
