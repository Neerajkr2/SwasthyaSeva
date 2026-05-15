# backend/ml/report_analyzer.py
"""
Medical Report Analyzer — Enhanced (Module 1 Redesign)
======================================================
1. Accepts PDF or image bytes
2. Extracts text via pytesseract (OCR) or PyPDF2
3. Auto-detects report type (blood_test, ecg, prescription, discharge, lab, xray)
4. Parses lab values using regex against a comprehensive reference range table
5. Detects medicines from prescription / discharge text
6. Computes a 0-100 health score from lab values
7. Returns structured data for the multi-tab frontend dashboard
"""
from __future__ import annotations
import re, logging, io, math
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# ── Reference ranges ──────────────────────────────────────────────────────────
# Format: {parameter_name: (low, high, unit, category)}
REFERENCE_RANGES: Dict[str, tuple] = {
    # CBC (Hematology)
    "haemoglobin":       (12.0, 17.5,  "g/dL",       "Hematology"),
    "hemoglobin":        (12.0, 17.5,  "g/dL",       "Hematology"),
    "hb":                (12.0, 17.5,  "g/dL",       "Hematology"),
    "rbc":               (4.2,  5.9,   "million/uL", "Hematology"),
    "wbc":               (4000, 11000, "cells/uL",   "Hematology"),
    "platelets":         (150000, 400000, "/uL",      "Hematology"),
    "hematocrit":        (36.0, 52.0,  "%",          "Hematology"),
    "mcv":               (80.0, 100.0, "fL",         "Hematology"),
    "mch":               (27.0, 33.0,  "pg",         "Hematology"),
    "mchc":              (32.0, 36.0,  "g/dL",       "Hematology"),
    "esr":               (0,    20.0,  "mm/hr",      "Hematology"),
    "neutrophils":       (40.0, 70.0,  "%",          "Hematology"),
    "lymphocytes":       (20.0, 40.0,  "%",          "Hematology"),
    "monocytes":         (2.0,  8.0,   "%",          "Hematology"),
    "eosinophils":       (1.0,  4.0,   "%",          "Hematology"),
    "basophils":         (0.0,  1.0,   "%",          "Hematology"),
    # Glucose / Diabetes
    "fasting glucose":   (70.0, 100.0, "mg/dL",      "Glucose / Diabetes"),
    "glucose":           (70.0, 140.0, "mg/dL",      "Glucose / Diabetes"),
    "random glucose":    (70.0, 140.0, "mg/dL",      "Glucose / Diabetes"),
    "hba1c":             (4.0,  5.7,   "%",          "Glucose / Diabetes"),
    "fasting insulin":   (2.6,  24.9,  "uIU/mL",    "Glucose / Diabetes"),
    # Lipid Panel
    "total cholesterol": (0,    200.0, "mg/dL",      "Lipid Panel"),
    "cholesterol":       (0,    200.0, "mg/dL",      "Lipid Panel"),
    "ldl":               (0,    100.0, "mg/dL",      "Lipid Panel"),
    "hdl":               (40.0, 999.0, "mg/dL",      "Lipid Panel"),
    "triglycerides":     (0,    150.0, "mg/dL",      "Lipid Panel"),
    "vldl":              (2.0,  30.0,  "mg/dL",      "Lipid Panel"),
    # Liver Panel
    "sgot":              (10.0, 40.0,  "U/L",        "Liver Panel"),
    "ast":               (10.0, 40.0,  "U/L",        "Liver Panel"),
    "sgpt":              (7.0,  56.0,  "U/L",        "Liver Panel"),
    "alt":               (7.0,  56.0,  "U/L",        "Liver Panel"),
    "alp":               (44.0, 147.0, "U/L",        "Liver Panel"),
    "alkaline phosphatase": (44.0, 147.0, "U/L",     "Liver Panel"),
    "ggt":               (9.0,  48.0,  "U/L",        "Liver Panel"),
    "bilirubin":         (0.1,  1.2,   "mg/dL",      "Liver Panel"),
    "total bilirubin":   (0.1,  1.2,   "mg/dL",      "Liver Panel"),
    "direct bilirubin":  (0.0,  0.3,   "mg/dL",      "Liver Panel"),
    "albumin":           (3.5,  5.5,   "g/dL",       "Liver Panel"),
    "globulin":          (2.0,  3.5,   "g/dL",       "Liver Panel"),
    "total protein":     (6.0,  8.3,   "g/dL",       "Liver Panel"),
    # Kidney Panel
    "creatinine":        (0.6,  1.2,   "mg/dL",      "Kidney Panel"),
    "urea":              (7.0,  25.0,  "mg/dL",      "Kidney Panel"),
    "bun":               (7.0,  20.0,  "mg/dL",      "Kidney Panel"),
    "uric acid":         (3.5,  7.2,   "mg/dL",      "Kidney Panel"),
    "egfr":              (90.0, 999.0, "mL/min",     "Kidney Panel"),
    # Thyroid Panel
    "tsh":               (0.4,  4.0,   "mIU/L",      "Thyroid Panel"),
    "t3":                (80.0, 200.0, "ng/dL",      "Thyroid Panel"),
    "t4":                (5.0,  12.0,  "ug/dL",      "Thyroid Panel"),
    "free t3":           (2.3,  4.2,   "pg/mL",      "Thyroid Panel"),
    "free t4":           (0.8,  1.8,   "ng/dL",      "Thyroid Panel"),
    # Electrolytes
    "sodium":            (136.0, 145.0, "mEq/L",     "Electrolytes"),
    "potassium":         (3.5,  5.1,   "mEq/L",      "Electrolytes"),
    "calcium":           (8.5,  10.5,  "mg/dL",      "Electrolytes"),
    "chloride":          (98.0, 106.0, "mEq/L",      "Electrolytes"),
    "magnesium":         (1.7,  2.2,   "mg/dL",      "Electrolytes"),
    "phosphorus":        (2.5,  4.5,   "mg/dL",      "Electrolytes"),
    # Vitamins & Minerals
    "iron":              (60.0, 170.0, "ug/dL",      "Vitamins & Minerals"),
    "ferritin":          (20.0, 250.0, "ng/mL",      "Vitamins & Minerals"),
    "vitamin d":         (20.0, 50.0,  "ng/mL",      "Vitamins & Minerals"),
    "vitamin b12":       (200.0, 900.0,"pg/mL",      "Vitamins & Minerals"),
    "folic acid":        (2.7,  17.0,  "ng/mL",      "Vitamins & Minerals"),
    "tibc":              (250.0, 370.0,"ug/dL",      "Vitamins & Minerals"),
    # Cardiac Markers
    "troponin":          (0.0,  0.04,  "ng/mL",      "Cardiac Markers"),
    "ck-mb":             (0.0,  25.0,  "U/L",        "Cardiac Markers"),
    "bnp":               (0.0,  100.0, "pg/mL",      "Cardiac Markers"),
    "crp":               (0.0,  3.0,   "mg/L",       "Cardiac Markers"),
    "hs-crp":            (0.0,  3.0,   "mg/L",       "Cardiac Markers"),
    "ldh":               (140.0, 280.0,"U/L",        "Cardiac Markers"),
    # Pancreatic
    "amylase":           (28.0, 100.0, "U/L",        "Pancreatic"),
    "lipase":            (0.0,  160.0, "U/L",        "Pancreatic"),
    # Coagulation
    "pt":                (11.0, 13.5,  "seconds",    "Coagulation"),
    "inr":               (0.8,  1.1,   "",           "Coagulation"),
    "aptt":              (25.0, 35.0,  "seconds",    "Coagulation"),
}

# ── Common medicine patterns ─────────────────────────────────────────────────
COMMON_MEDICINES = [
    # Diabetes
    "metformin", "glimepiride", "gliclazide", "sitagliptin", "pioglitazone",
    "voglibose", "insulin", "dapagliflozin", "empagliflozin",
    # Cardiovascular
    "aspirin", "clopidogrel", "atorvastatin", "rosuvastatin", "amlodipine",
    "telmisartan", "losartan", "ramipril", "enalapril", "metoprolol",
    "nebivolol", "atenolol", "furosemide", "torsemide", "spironolactone",
    "digoxin", "warfarin", "enoxaparin", "rivaroxaban", "apixaban",
    # Pain / Anti-inflammatory
    "paracetamol", "acetaminophen", "ibuprofen", "diclofenac", "naproxen",
    "aceclofenac", "tramadol", "pregabalin", "gabapentin",
    # Antibiotics
    "amoxicillin", "azithromycin", "ciprofloxacin", "levofloxacin",
    "metronidazole", "doxycycline", "cephalexin", "cefixime", "ceftriaxone",
    "augmentin", "clindamycin", "nitrofurantoin",
    # GI
    "pantoprazole", "omeprazole", "rabeprazole", "domperidone",
    "ondansetron", "ranitidine", "sucralfate", "lactulose",
    # Respiratory
    "salbutamol", "montelukast", "cetirizine", "levocetirizine",
    "fexofenadine", "loratadine", "budesonide", "fluticasone",
    # Thyroid
    "levothyroxine", "thyroxine",
    # Vitamins / Supplements
    "calcium", "vitamin d3", "cholecalciferol", "methylcobalamin",
    "folic acid", "iron", "ferrous",
    # Psychiatric
    "escitalopram", "sertraline", "fluoxetine", "alprazolam",
    "clonazepam", "olanzapine", "risperidone", "lithium",
    # Others
    "prednisone", "prednisolone", "hydroxychloroquine", "methotrexate",
]

# Medicine pattern: looks for common medicine names in text
_MEDICINE_PATTERN = re.compile(
    r'\b(' + '|'.join(re.escape(m) for m in COMMON_MEDICINES) + r')\b',
    re.IGNORECASE
)

# Dosage pattern: number + mg/mcg/ml etc (possibly followed by frequency)
_DOSAGE_PATTERN = re.compile(
    r'(\d+\.?\d*)\s*(mg|mcg|ml|g|iu|units?)\b',
    re.IGNORECASE
)

# Frequency patterns
_FREQUENCY_PATTERNS = {
    "once daily":     re.compile(r'\b(once\s+daily|od|qd|once\s+a\s+day)\b', re.I),
    "twice daily":    re.compile(r'\b(twice\s+daily|bd|bid|b\.d\.|twice\s+a\s+day)\b', re.I),
    "thrice daily":   re.compile(r'\b(thrice\s+daily|tds|tid|t\.d\.s\.|three\s+times)\b', re.I),
    "at bedtime":     re.compile(r'\b(at\s+bedtime|hs|at\s+night|before\s+sleep)\b', re.I),
    "before meals":   re.compile(r'\b(before\s+(meals?|food|breakfast|lunch|dinner)|ac|a\.c\.)\b', re.I),
    "after meals":    re.compile(r'\b(after\s+(meals?|food|breakfast|lunch|dinner)|pc|p\.c\.)\b', re.I),
    "morning":        re.compile(r'\b(morning|am|a\.m\.)\b', re.I),
    "evening":        re.compile(r'\b(evening|pm|p\.m\.)\b', re.I),
    "as needed":      re.compile(r'\b(as\s+needed|prn|sos|when\s+required)\b', re.I),
}

# ── Report type detection keywords ────────────────────────────────────────────
REPORT_TYPE_KEYWORDS = {
    "blood_test":   ["cbc", "complete blood count", "hemoglobin", "haemoglobin", "wbc",
                     "rbc", "platelets", "hematocrit", "blood test", "blood report",
                     "hba1c", "glucose", "lipid", "cholesterol", "thyroid"],
    "liver_panel":  ["liver function", "lft", "sgpt", "sgot", "alt", "ast",
                     "bilirubin", "albumin", "hepatic"],
    "kidney_panel": ["kidney function", "kft", "rft", "creatinine", "urea",
                     "bun", "egfr", "renal"],
    "ecg":          ["ecg", "ekg", "electrocardiogram", "heart rate",
                     "rhythm", "sinus", "qrs", "st segment"],
    "prescription": ["rx", "prescription", "prescribed", "tablet", "capsule",
                     "syrup", "injection", "dosage", "twice daily", "once daily",
                     "after food", "before food", "tab.", "cap."],
    "discharge":    ["discharge summary", "discharged", "admission",
                     "hospital stay", "diagnosis", "treatment given",
                     "follow up", "follow-up"],
    "xray":         ["x-ray", "xray", "radiograph", "chest pa", "impression",
                     "opacity", "lung field", "cardiothoracic"],
    "urine":        ["urine", "urinalysis", "urine routine", "specific gravity",
                     "ph", "protein trace", "pus cells"],
}

# ── Condition detection rules ─────────────────────────────────────────────────
CONDITION_RULES = [
    {
        "name": "Diabetes / Pre-Diabetes",
        "markers": ["glucose", "fasting glucose", "hba1c", "fasting insulin", "random glucose"],
        "check": lambda vals: any(
            (v["parameter"].lower() in ["glucose", "fasting glucose", "random glucose"] and v["value"] > 126) or
            (v["parameter"].lower() == "hba1c" and v["value"] > 6.4)
            for v in vals
        ),
        "severity_check": lambda vals: "severe" if any(
            (v["parameter"].lower() in ["glucose", "fasting glucose"] and v["value"] > 200) or
            (v["parameter"].lower() == "hba1c" and v["value"] > 8.0)
            for v in vals
        ) else "moderate" if any(
            (v["parameter"].lower() in ["glucose", "fasting glucose"] and v["value"] > 126) or
            (v["parameter"].lower() == "hba1c" and v["value"] > 6.4)
            for v in vals
        ) else "mild",
    },
    {
        "name": "Anemia",
        "markers": ["hemoglobin", "haemoglobin", "hb", "rbc", "ferritin", "iron", "mcv"],
        "check": lambda vals: any(
            v["parameter"].lower() in ["hemoglobin", "haemoglobin", "hb"] and v["value"] < 12.0
            for v in vals
        ),
        "severity_check": lambda vals: "severe" if any(
            v["parameter"].lower() in ["hemoglobin", "haemoglobin", "hb"] and v["value"] < 8.0
            for v in vals
        ) else "moderate" if any(
            v["parameter"].lower() in ["hemoglobin", "haemoglobin", "hb"] and v["value"] < 10.0
            for v in vals
        ) else "mild",
    },
    {
        "name": "Dyslipidemia",
        "markers": ["total cholesterol", "cholesterol", "ldl", "hdl", "triglycerides"],
        "check": lambda vals: any(
            (v["parameter"].lower() in ["total cholesterol", "cholesterol"] and v["value"] > 200) or
            (v["parameter"].lower() == "ldl" and v["value"] > 130) or
            (v["parameter"].lower() == "triglycerides" and v["value"] > 150)
            for v in vals
        ),
        "severity_check": lambda vals: "severe" if any(
            (v["parameter"].lower() in ["total cholesterol", "cholesterol"] and v["value"] > 280) or
            (v["parameter"].lower() == "ldl" and v["value"] > 190) or
            (v["parameter"].lower() == "triglycerides" and v["value"] > 500)
            for v in vals
        ) else "moderate" if any(
            (v["parameter"].lower() in ["total cholesterol", "cholesterol"] and v["value"] > 240) or
            (v["parameter"].lower() == "ldl" and v["value"] > 160)
            for v in vals
        ) else "mild",
    },
    {
        "name": "Liver Disorder",
        "markers": ["sgpt", "alt", "sgot", "ast", "bilirubin", "total bilirubin", "alp", "ggt"],
        "check": lambda vals: any(
            (v["parameter"].lower() in ["sgpt", "alt"] and v["value"] > 56) or
            (v["parameter"].lower() in ["sgot", "ast"] and v["value"] > 40) or
            (v["parameter"].lower() in ["bilirubin", "total bilirubin"] and v["value"] > 1.2)
            for v in vals
        ),
        "severity_check": lambda vals: "severe" if any(
            (v["parameter"].lower() in ["sgpt", "alt"] and v["value"] > 200) or
            (v["parameter"].lower() in ["bilirubin", "total bilirubin"] and v["value"] > 3.0)
            for v in vals
        ) else "moderate" if any(
            (v["parameter"].lower() in ["sgpt", "alt"] and v["value"] > 100)
            for v in vals
        ) else "mild",
    },
    {
        "name": "Kidney Dysfunction",
        "markers": ["creatinine", "urea", "bun", "egfr", "uric acid"],
        "check": lambda vals: any(
            (v["parameter"].lower() == "creatinine" and v["value"] > 1.2) or
            (v["parameter"].lower() == "urea" and v["value"] > 25) or
            (v["parameter"].lower() == "egfr" and v["value"] < 90)
            for v in vals
        ),
        "severity_check": lambda vals: "severe" if any(
            (v["parameter"].lower() == "creatinine" and v["value"] > 3.0) or
            (v["parameter"].lower() == "egfr" and v["value"] < 30)
            for v in vals
        ) else "moderate" if any(
            (v["parameter"].lower() == "creatinine" and v["value"] > 1.8)
            for v in vals
        ) else "mild",
    },
    {
        "name": "Thyroid Disorder",
        "markers": ["tsh", "t3", "t4", "free t3", "free t4"],
        "check": lambda vals: any(
            (v["parameter"].lower() == "tsh" and (v["value"] < 0.4 or v["value"] > 4.0))
            for v in vals
        ),
        "severity_check": lambda vals: "severe" if any(
            (v["parameter"].lower() == "tsh" and (v["value"] < 0.1 or v["value"] > 10.0))
            for v in vals
        ) else "moderate" if any(
            (v["parameter"].lower() == "tsh" and (v["value"] < 0.2 or v["value"] > 6.0))
            for v in vals
        ) else "mild",
    },
    {
        "name": "Vitamin D Deficiency",
        "markers": ["vitamin d"],
        "check": lambda vals: any(
            v["parameter"].lower() == "vitamin d" and v["value"] < 20
            for v in vals
        ),
        "severity_check": lambda vals: "severe" if any(
            v["parameter"].lower() == "vitamin d" and v["value"] < 10
            for v in vals
        ) else "mild",
    },
    {
        "name": "Vitamin B12 Deficiency",
        "markers": ["vitamin b12"],
        "check": lambda vals: any(
            v["parameter"].lower() == "vitamin b12" and v["value"] < 200
            for v in vals
        ),
        "severity_check": lambda vals: "severe" if any(
            v["parameter"].lower() == "vitamin b12" and v["value"] < 150
            for v in vals
        ) else "mild",
    },
    {
        "name": "Infection / Inflammation",
        "markers": ["wbc", "esr", "crp", "hs-crp", "neutrophils"],
        "check": lambda vals: any(
            (v["parameter"].lower() == "wbc" and v["value"] > 11000) or
            (v["parameter"].lower() == "esr" and v["value"] > 20) or
            (v["parameter"].lower() in ["crp", "hs-crp"] and v["value"] > 3.0)
            for v in vals
        ),
        "severity_check": lambda vals: "severe" if any(
            (v["parameter"].lower() == "wbc" and v["value"] > 20000) or
            (v["parameter"].lower() in ["crp", "hs-crp"] and v["value"] > 10.0)
            for v in vals
        ) else "moderate" if any(
            (v["parameter"].lower() == "wbc" and v["value"] > 15000)
            for v in vals
        ) else "mild",
    },
]


# ── Regex to extract key:value lab results ────────────────────────────────────
LAB_VALUE_PATTERN = re.compile(
    r'([A-Za-z][A-Za-z0-9 \(\)/\-]{2,30}?)\s*[:=]\s*(\d+\.?\d*)\s*([A-Za-z%/\-]+(?:/[A-Za-z]+)?)',
    re.IGNORECASE
)


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        if text.strip():
            return text
    except Exception as e:
        logger.warning(f"PyPDF2 extraction failed: {e}")

    try:
        from pdf2image import convert_from_bytes
        import pytesseract
        images = convert_from_bytes(file_bytes, dpi=200)
        text = "\n".join(pytesseract.image_to_string(img) for img in images)
        return text
    except Exception as e:
        logger.error(f"PDF->image OCR failed: {e}")
        return ""


def _extract_text_from_image(file_bytes: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes))
        return pytesseract.image_to_string(img)
    except Exception as e:
        logger.error(f"Image OCR failed: {e}")
        return ""


def _detect_report_type(text: str) -> str:
    """Auto-detect report type from extracted text content."""
    text_lower = text.lower()
    scores = {}
    for rtype, keywords in REPORT_TYPE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[rtype] = score

    if not scores:
        return "general"
    return max(scores, key=scores.get)


def _parse_lab_values(text: str) -> List[Dict[str, Any]]:
    results = []
    seen = set()

    for match in LAB_VALUE_PATTERN.finditer(text):
        raw_name, raw_val, raw_unit = match.groups()
        name = raw_name.strip().lower().rstrip(":= ")
        key = re.sub(r"\s+", " ", name)

        if key in seen:
            continue
        seen.add(key)

        try:
            value = float(raw_val)
        except ValueError:
            continue

        ref = REFERENCE_RANGES.get(key)
        entry = {
            "parameter": raw_name.strip().title(),
            "value":     value,
            "unit":      raw_unit,
            "status":    "unknown",
            "category":  "Other",
        }

        if ref:
            low, high, std_unit, category = ref
            entry["reference_low"]  = low
            entry["reference_high"] = high
            entry["reference_unit"] = std_unit
            entry["category"]       = category
            if value < low:
                entry["status"] = "low"
                entry["flag"]   = f"Below normal (Normal: {low}-{high} {std_unit})"
            elif value > high:
                entry["status"] = "high"
                entry["flag"]   = f"Above normal (Normal: {low}-{high} {std_unit})"
            else:
                entry["status"] = "normal"
                entry["flag"]   = "Normal range"
        else:
            entry["flag"] = "Reference range not in database"

        results.append(entry)

    return results


def _detect_medicines(text: str) -> List[Dict[str, Any]]:
    """Extract medicine names, dosages, and schedules from text."""
    medicines = []
    seen = set()
    text_lower = text.lower()

    for match in _MEDICINE_PATTERN.finditer(text):
        med_name = match.group(1).strip()
        med_key = med_name.lower()
        if med_key in seen:
            continue
        seen.add(med_key)

        # Look for dosage nearby (within ~60 chars after the match)
        start = match.end()
        context = text[start:start + 80]

        dosage_match = _DOSAGE_PATTERN.search(context)
        dosage = f"{dosage_match.group(1)} {dosage_match.group(2)}" if dosage_match else ""

        # Detect frequency
        freq_context = text[max(0, match.start() - 20):match.end() + 100].lower()
        frequency = ""
        schedule = "morning"  # default
        for freq_name, freq_re in _FREQUENCY_PATTERNS.items():
            if freq_re.search(freq_context):
                frequency = freq_name
                if "bedtime" in freq_name or "night" in freq_name or "evening" in freq_name:
                    schedule = "night"
                elif "twice" in freq_name:
                    schedule = "morning,evening"
                elif "thrice" in freq_name:
                    schedule = "morning,afternoon,evening"
                break

        # Determine purpose based on known drug classes
        purpose = _get_medicine_purpose(med_key)

        medicines.append({
            "name": med_name.title(),
            "dosage": dosage,
            "frequency": frequency,
            "schedule": schedule,
            "purpose": purpose,
        })

    return medicines


def _get_medicine_purpose(med_name: str) -> str:
    """Map medicine to its general purpose."""
    purposes = {
        "diabetes": ["metformin", "glimepiride", "gliclazide", "sitagliptin",
                     "pioglitazone", "voglibose", "insulin", "dapagliflozin", "empagliflozin"],
        "blood pressure": ["amlodipine", "telmisartan", "losartan", "ramipril",
                          "enalapril", "metoprolol", "nebivolol", "atenolol"],
        "cholesterol": ["atorvastatin", "rosuvastatin"],
        "blood thinner": ["aspirin", "clopidogrel", "warfarin", "enoxaparin",
                         "rivaroxaban", "apixaban"],
        "pain relief": ["paracetamol", "acetaminophen", "ibuprofen", "diclofenac",
                       "naproxen", "aceclofenac", "tramadol"],
        "nerve pain": ["pregabalin", "gabapentin"],
        "antibiotic": ["amoxicillin", "azithromycin", "ciprofloxacin", "levofloxacin",
                      "metronidazole", "doxycycline", "cephalexin", "cefixime",
                      "ceftriaxone", "augmentin", "clindamycin", "nitrofurantoin"],
        "acid reflux / stomach": ["pantoprazole", "omeprazole", "rabeprazole",
                                 "domperidone", "ondansetron", "ranitidine", "sucralfate"],
        "breathing / allergy": ["salbutamol", "montelukast", "cetirizine",
                                "levocetirizine", "fexofenadine", "loratadine",
                                "budesonide", "fluticasone"],
        "thyroid": ["levothyroxine", "thyroxine"],
        "vitamin / supplement": ["calcium", "vitamin d3", "cholecalciferol",
                                "methylcobalamin", "folic acid", "iron", "ferrous"],
        "mental health": ["escitalopram", "sertraline", "fluoxetine", "alprazolam",
                         "clonazepam", "olanzapine", "risperidone", "lithium"],
        "anti-inflammatory": ["prednisone", "prednisolone", "hydroxychloroquine", "methotrexate"],
        "water pill / diuretic": ["furosemide", "torsemide", "spironolactone"],
        "heart": ["digoxin"],
        "laxative": ["lactulose"],
    }
    for purpose, meds in purposes.items():
        if med_name in meds:
            return purpose.title()
    return ""


def _detect_conditions(lab_values: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Detect conditions from abnormal lab values using rule-based logic."""
    conditions = []
    abnormal_vals = [v for v in lab_values if v["status"] in ("high", "low")]

    for rule in CONDITION_RULES:
        try:
            if rule["check"](abnormal_vals):
                severity = rule["severity_check"](abnormal_vals)
                related = [
                    v["parameter"] for v in abnormal_vals
                    if v["parameter"].lower() in rule["markers"]
                ]
                # Calculate confidence based on how many related markers are abnormal
                matching_markers = sum(
                    1 for v in abnormal_vals
                    if v["parameter"].lower() in rule["markers"]
                )
                confidence = min(0.95, 0.5 + matching_markers * 0.15)

                conditions.append({
                    "name": rule["name"],
                    "confidence": round(confidence, 2),
                    "severity": severity,
                    "related_markers": related,
                })
        except Exception as e:
            logger.warning(f"Condition check failed for {rule['name']}: {e}")

    # Sort by confidence descending
    conditions.sort(key=lambda c: c["confidence"], reverse=True)
    return conditions


def _calculate_health_score(lab_values: List[Dict[str, Any]],
                            conditions: List[Dict[str, Any]]) -> int:
    """
    Calculate a 0-100 health score based on lab values and detected conditions.
    100 = all normal, 0 = multiple severe abnormalities.
    """
    if not lab_values:
        return 75  # neutral when no data

    total = len(lab_values)
    known = [v for v in lab_values if v["status"] != "unknown"]
    if not known:
        return 75

    normal_count = sum(1 for v in known if v["status"] == "normal")
    abnormal_count = len(known) - normal_count

    # Base score from normal ratio
    base_score = (normal_count / len(known)) * 100

    # Penalty for each detected condition
    condition_penalty = 0
    for c in conditions:
        sev = c.get("severity", "mild")
        if sev == "severe":
            condition_penalty += 15
        elif sev == "moderate":
            condition_penalty += 8
        else:
            condition_penalty += 3

    score = base_score - condition_penalty
    return max(0, min(100, round(score)))


class ReportAnalyzer:
    """Enhanced Report Analyzer with multi-layer analysis."""

    @staticmethod
    def analyze(file_bytes: bytes, media_type: str) -> dict:
        """Full analysis pipeline returning structured data for all frontend tabs."""
        # 1. Extract text
        if media_type == "application/pdf":
            text = _extract_text_from_pdf(file_bytes)
        elif media_type.startswith("image/"):
            text = _extract_text_from_image(file_bytes)
        else:
            text = ""

        text = text.strip()

        # 2. Detect report type
        report_type = _detect_report_type(text) if text else "general"

        # 3. Parse lab values
        lab_values = _parse_lab_values(text)
        abnormal = [v for v in lab_values if v["status"] in ("high", "low")]

        # 4. Detect conditions from abnormal values
        conditions = _detect_conditions(lab_values)

        # 5. Detect medicines (for prescriptions / discharge summaries)
        medicines = _detect_medicines(text)

        # 6. Calculate health score
        health_score = _calculate_health_score(lab_values, conditions)

        # 7. Group lab values by category
        categories = {}
        for v in lab_values:
            cat = v.get("category", "Other")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(v)

        return {
            "extracted_text":    text[:4000] if text else "(No text extracted)",
            "report_type":       report_type,
            "health_score":      health_score,
            "lab_values":        lab_values,
            "abnormal_values":   abnormal,
            "conditions":        conditions,
            "medicines":         medicines,
            "categories":        categories,
        }
