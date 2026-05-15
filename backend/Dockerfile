# backend/Dockerfile
FROM python:3.11-slim

# System deps for pytesseract + pdf2image + psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng \
    poppler-utils \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_sm || true

COPY . .

# Pre-create saved_models dir
RUN mkdir -p ml/saved_models

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
