# backend/ml/symptom_analyzer.py
"""
Symptom Analyzer (NLP) — Enhanced (Module 2 Redesign)
=====================================================
Uses HuggingFace transformers (facebook/bart-large-mnli) for zero-shot classification
of symptom text into possible medical conditions.

Enhanced with:
  - Conversational follow-up question generation
  - Body system mapping
  - Severity assessment with detailed scoring
  - Self-care guidance generation
  - Food/nutrition recommendations
  - Recovery plan generation (7d/30d/6m/1y)
  - Specialist recommendation

Falls back to a keyword-rule engine when the model isn't available.
"""
from __future__ import annotations
import logging, re
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# ── Candidate conditions for zero-shot classification ────────────────────────
CANDIDATE_CONDITIONS = [
    "Common cold",
    "Influenza (flu)",
    "COVID-19",
    "Dengue fever",
    "Malaria",
    "Typhoid fever",
    "Pneumonia",
    "Asthma",
    "Hypertension (high blood pressure)",
    "Type 2 diabetes",
    "Hypoglycaemia (low blood sugar)",
    "Migraine",
    "Tension headache",
    "Urinary tract infection (UTI)",
    "Gastroenteritis",
    "Irritable bowel syndrome (IBS)",
    "Appendicitis",
    "Kidney stones",
    "Anemia",
    "Hypothyroidism",
    "Hyperthyroidism",
    "Anxiety disorder",
    "Depression",
    "Acid reflux (GERD)",
    "Peptic ulcer",
    "Liver disease",
    "Heart attack (Myocardial infarction)",
    "Angina pectoris",
    "Stroke",
    "Allergic reaction",
    "Dermatitis",
    "Conjunctivitis (Pink eye)",
    "Sinusitis",
    "Bronchitis",
    "Tuberculosis",
    "Vitamin D deficiency",
    "Iron deficiency anaemia",
]

# ── Body system mapping ──────────────────────────────────────────────────────
CONDITION_BODY_SYSTEM = {
    "Common cold":                          "Respiratory",
    "Influenza (flu)":                      "Respiratory",
    "COVID-19":                             "Respiratory",
    "Pneumonia":                            "Respiratory",
    "Asthma":                               "Respiratory",
    "Bronchitis":                           "Respiratory",
    "Tuberculosis":                         "Respiratory",
    "Sinusitis":                            "Respiratory",
    "Dengue fever":                         "Infectious",
    "Malaria":                              "Infectious",
    "Typhoid fever":                        "Infectious",
    "Hypertension (high blood pressure)":   "Cardiovascular",
    "Heart attack (Myocardial infarction)": "Cardiovascular",
    "Angina pectoris":                      "Cardiovascular",
    "Stroke":                               "Neurological",
    "Migraine":                             "Neurological",
    "Tension headache":                     "Neurological",
    "Type 2 diabetes":                      "Endocrine",
    "Hypoglycaemia (low blood sugar)":      "Endocrine",
    "Hypothyroidism":                       "Endocrine",
    "Hyperthyroidism":                      "Endocrine",
    "Gastroenteritis":                      "Digestive",
    "Irritable bowel syndrome (IBS)":       "Digestive",
    "Acid reflux (GERD)":                   "Digestive",
    "Peptic ulcer":                         "Digestive",
    "Appendicitis":                         "Digestive",
    "Liver disease":                        "Digestive",
    "Urinary tract infection (UTI)":        "Urinary",
    "Kidney stones":                        "Urinary",
    "Anemia":                               "Hematological",
    "Iron deficiency anaemia":              "Hematological",
    "Vitamin D deficiency":                 "Musculoskeletal",
    "Anxiety disorder":                     "Mental Health",
    "Depression":                           "Mental Health",
    "Allergic reaction":                    "Immune",
    "Dermatitis":                           "Skin",
    "Conjunctivitis (Pink eye)":            "Eyes",
}

# ── Specialist mapping ───────────────────────────────────────────────────────
CONDITION_SPECIALIST = {
    "Common cold":                          "General Physician",
    "Influenza (flu)":                      "General Physician",
    "COVID-19":                             "Pulmonologist",
    "Pneumonia":                            "Pulmonologist",
    "Asthma":                               "Pulmonologist",
    "Bronchitis":                           "Pulmonologist",
    "Tuberculosis":                         "Pulmonologist",
    "Sinusitis":                            "ENT Specialist",
    "Dengue fever":                         "Internal Medicine",
    "Malaria":                              "Internal Medicine",
    "Typhoid fever":                        "Internal Medicine",
    "Hypertension (high blood pressure)":   "Cardiologist",
    "Heart attack (Myocardial infarction)": "Cardiologist",
    "Angina pectoris":                      "Cardiologist",
    "Stroke":                               "Neurologist",
    "Migraine":                             "Neurologist",
    "Tension headache":                     "Neurologist",
    "Type 2 diabetes":                      "Endocrinologist",
    "Hypothyroidism":                       "Endocrinologist",
    "Hyperthyroidism":                      "Endocrinologist",
    "Gastroenteritis":                      "Gastroenterologist",
    "Irritable bowel syndrome (IBS)":       "Gastroenterologist",
    "Acid reflux (GERD)":                   "Gastroenterologist",
    "Peptic ulcer":                         "Gastroenterologist",
    "Appendicitis":                         "General Surgeon",
    "Liver disease":                        "Hepatologist",
    "Urinary tract infection (UTI)":        "Urologist",
    "Kidney stones":                        "Urologist",
    "Anemia":                               "Hematologist",
    "Iron deficiency anaemia":              "Hematologist",
    "Anxiety disorder":                     "Psychiatrist",
    "Depression":                           "Psychiatrist",
    "Allergic reaction":                    "Allergist",
    "Dermatitis":                           "Dermatologist",
    "Conjunctivitis (Pink eye)":            "Ophthalmologist",
}

# ── Self-care guidance per condition ─────────────────────────────────────────
SELF_CARE_GUIDANCE = {
    "Common cold": {
        "immediate": ["Rest at home", "Stay well hydrated with warm fluids", "Gargle with warm salt water"],
        "otc_meds": ["Paracetamol for fever and pain", "Nasal decongestant spray", "Cough suppressant if dry cough"],
        "warning_signs": ["Fever above 103F for more than 3 days", "Difficulty breathing", "Chest pain"],
    },
    "Influenza (flu)": {
        "immediate": ["Bed rest for 3-5 days", "Stay hydrated - water, soups, electrolyte drinks", "Isolate to prevent spread"],
        "otc_meds": ["Paracetamol for fever", "Antihistamine for runny nose"],
        "warning_signs": ["Severe difficulty breathing", "Confusion or dizziness", "Persistent vomiting"],
    },
    "Migraine": {
        "immediate": ["Rest in a dark, quiet room", "Apply cold compress to forehead", "Avoid screens and bright light"],
        "otc_meds": ["Ibuprofen or aspirin (early)", "Antiemetic if nausea present"],
        "warning_signs": ["Worst headache of your life", "Sudden onset with stiff neck", "Vision loss or speech difficulty"],
    },
    "Gastroenteritis": {
        "immediate": ["Oral rehydration solution (ORS)", "BRAT diet: bananas, rice, applesauce, toast", "Rest the stomach - small sips"],
        "otc_meds": ["ORS packets", "Ondansetron if prescribed for vomiting", "Probiotics after acute phase"],
        "warning_signs": ["Blood in stool or vomit", "Unable to keep fluids down for 24 hours", "Signs of dehydration - dry mouth, no urination"],
    },
    "Urinary tract infection (UTI)": {
        "immediate": ["Drink plenty of water (3+ liters/day)", "Avoid caffeine and alcohol", "Maintain good hygiene"],
        "otc_meds": ["Paracetamol for pain", "Cranberry supplements may help"],
        "warning_signs": ["High fever with chills", "Severe flank/back pain", "Blood in urine"],
    },
    "Anxiety disorder": {
        "immediate": ["Practice deep breathing: 4-7-8 technique", "Ground yourself: 5-4-3-2-1 senses exercise", "Remove yourself from stressful environment"],
        "otc_meds": ["Avoid self-medication", "Consult a professional for appropriate treatment"],
        "warning_signs": ["Panic attacks lasting over 30 minutes", "Suicidal thoughts", "Inability to function daily"],
    },
    "Depression": {
        "immediate": ["Maintain daily routine", "Light physical activity - even a short walk", "Reach out to a trusted person"],
        "otc_meds": ["Do not self-medicate", "Professional evaluation recommended"],
        "warning_signs": ["Suicidal thoughts or self-harm ideation", "Inability to eat or sleep for days", "Complete withdrawal from activities"],
    },
}

# Default self-care for conditions without specific guidance
DEFAULT_SELF_CARE = {
    "immediate": ["Rest and avoid overexertion", "Stay well hydrated", "Monitor symptoms closely"],
    "otc_meds": ["Paracetamol for pain/fever if needed", "Consult pharmacist for appropriate options"],
    "warning_signs": ["Symptoms worsening rapidly", "High fever not responding to medication", "New severe symptoms appearing"],
}

# ── Food guidance per body system ────────────────────────────────────────────
FOOD_GUIDANCE = {
    "Respiratory": {
        "healing_foods": ["Ginger tea for congestion", "Honey with warm water", "Citrus fruits (vitamin C)", "Garlic - natural antimicrobial", "Turmeric milk (golden milk)", "Steamed vegetables"],
        "avoid_foods": ["Cold drinks and ice cream", "Dairy (may increase mucus)", "Fried and oily foods", "Sugary drinks"],
        "hydration": "Warm fluids every 2 hours: herbal tea, warm water with lemon, clear soups",
    },
    "Digestive": {
        "healing_foods": ["Plain rice and dal (khichdi)", "Bananas and papaya", "Curd/yogurt (probiotics)", "Coconut water", "Boiled potatoes", "Toast with light butter"],
        "avoid_foods": ["Spicy food", "Fried and greasy food", "Raw vegetables initially", "Caffeine and alcohol", "Dairy if lactose intolerant"],
        "hydration": "ORS solution, coconut water, buttermilk, clear soups - small frequent sips",
    },
    "Cardiovascular": {
        "healing_foods": ["Oats and whole grains", "Leafy greens (spinach, kale)", "Fatty fish (omega-3)", "Nuts and seeds (almonds, walnuts)", "Berries and pomegranate", "Olive oil"],
        "avoid_foods": ["Excess salt and sodium", "Red meat and processed meats", "Trans fats and fried foods", "Sugary desserts", "Excessive caffeine"],
        "hydration": "6-8 glasses of water daily. Limit caffeinated beverages. Include green tea.",
    },
    "Endocrine": {
        "healing_foods": ["Whole grains (brown rice, oats)", "Lean protein (chicken, fish, dal)", "Green vegetables", "Nuts and seeds", "Low-glycemic fruits (berries, apple)", "Fenugreek (methi) seeds"],
        "avoid_foods": ["White rice and refined flour (maida)", "Sugary drinks and sweets", "Processed foods", "Fruit juices (high sugar)", "Excessive starchy foods"],
        "hydration": "Plenty of water. Jeera (cumin) water helps digestion. Avoid sugary drinks.",
    },
    "Neurological": {
        "healing_foods": ["Dark chocolate (small amounts)", "Fatty fish (omega-3)", "Leafy greens", "Walnuts", "Berries (blueberries)", "Pumpkin seeds (magnesium)"],
        "avoid_foods": ["Aged cheese", "Processed meats", "Alcohol", "Excessive caffeine", "MSG-containing foods", "Artificial sweeteners"],
        "hydration": "Stay well hydrated - dehydration can trigger headaches. 8+ glasses/day.",
    },
    "Mental Health": {
        "healing_foods": ["Fatty fish and walnuts (omega-3)", "Dark leafy greens (folate)", "Fermented foods (curd, kimchi)", "Whole grains", "Bananas (tryptophan)", "Dark chocolate (small amounts)"],
        "avoid_foods": ["Excessive caffeine", "Alcohol", "Refined sugar", "Processed junk food", "Energy drinks"],
        "hydration": "Regular water intake. Chamomile tea at bedtime. Limit coffee to morning only.",
    },
    "Urinary": {
        "healing_foods": ["Cranberries and blueberries", "Watermelon", "Cucumber", "Yogurt (probiotics)", "Barley water", "Coconut water"],
        "avoid_foods": ["Spicy food", "Caffeine", "Alcohol", "Citrus fruits (if irritating)", "Carbonated drinks"],
        "hydration": "Critical: 3+ liters of water daily. Barley water, coconut water, cranberry juice.",
    },
}

DEFAULT_FOOD_GUIDANCE = {
    "healing_foods": ["Fresh fruits and vegetables", "Whole grains", "Lean protein", "Nuts and seeds", "Yogurt", "Green tea"],
    "avoid_foods": ["Fried and processed foods", "Excessive sugar", "Alcohol", "Excessive caffeine"],
    "hydration": "Stay well hydrated with 8-10 glasses of water daily. Include herbal teas.",
}

# ── Urgency keyword mapping ───────────────────────────────────────────────────
EMERGENCY_KEYWORDS = [
    "chest pain", "difficulty breathing", "can't breathe", "shortness of breath",
    "unconscious", "stroke", "paralysis", "severe bleeding", "heart attack",
    "loss of consciousness", "seizure", "convulsions", "sudden numbness",
    "suicidal", "self harm", "want to die",
]
HIGH_KEYWORDS = [
    "high fever", "vomiting blood", "blood in stool", "severe headache",
    "confusion", "hallucination", "jaundice", "swollen throat",
    "difficulty swallowing", "severe abdominal pain", "worst headache",
]
MEDIUM_KEYWORDS = [
    "fever", "vomiting", "diarrhoea", "diarrhea", "rash", "cough",
    "fatigue", "weakness", "dizziness", "nausea", "persistent",
    "burning", "pain", "swelling", "stiffness",
]

# ── Follow-up question templates ─────────────────────────────────────────────
FOLLOW_UP_QUESTIONS = [
    {
        "trigger_keywords": ["pain", "ache", "hurt", "sore"],
        "question": "On a scale of 1-10, how severe is the pain?",
        "quick_replies": ["1-3 (Mild)", "4-6 (Moderate)", "7-8 (Severe)", "9-10 (Extreme)"],
    },
    {
        "trigger_keywords": ["fever", "temperature"],
        "question": "What is your approximate temperature? And how long have you had the fever?",
        "quick_replies": ["99-100F (Low)", "100-102F (Moderate)", "102-104F (High)", "Above 104F"],
    },
    {
        "trigger_keywords": [],  # Always ask if not already mentioned
        "question": "How long have you been experiencing these symptoms?",
        "quick_replies": ["Less than a day", "1-3 days", "3-7 days", "More than a week", "More than a month"],
    },
    {
        "trigger_keywords": [],
        "question": "Are you currently taking any medications?",
        "quick_replies": ["No medications", "Yes, for blood pressure", "Yes, for diabetes", "Yes, other medications"],
    },
    {
        "trigger_keywords": [],
        "question": "Do you have any pre-existing conditions like diabetes, heart disease, or asthma?",
        "quick_replies": ["None", "Diabetes", "Heart condition", "Asthma", "Multiple conditions"],
    },
]


def _detect_urgency(text: str) -> str:
    t = text.lower()
    if any(k in t for k in EMERGENCY_KEYWORDS): return "emergency"
    if any(k in t for k in HIGH_KEYWORDS):      return "high"
    if any(k in t for k in MEDIUM_KEYWORDS):    return "medium"
    return "low"


def _urgency_recommendation(urgency: str) -> str:
    return {
        "emergency": "Please call emergency services (112) or go to the nearest ER immediately.",
        "high":      "Please consult a doctor or visit a clinic today. Do not delay.",
        "medium":    "Schedule a doctor's appointment within 1-2 days.",
        "low":       "Monitor symptoms. Consult a doctor if symptoms persist beyond 3-5 days.",
    }[urgency]


def _get_follow_up_questions(text: str) -> List[Dict[str, Any]]:
    """Generate contextual follow-up questions based on symptoms mentioned."""
    t = text.lower()
    questions = []

    for fq in FOLLOW_UP_QUESTIONS:
        if fq["trigger_keywords"]:
            if any(kw in t for kw in fq["trigger_keywords"]):
                questions.append({
                    "question": fq["question"],
                    "quick_replies": fq["quick_replies"],
                })
        else:
            # Always-ask questions — check if info was already provided
            if "how long" in fq["question"].lower():
                # Skip if duration already mentioned
                has_duration = any(w in t for w in ["days", "weeks", "months", "hours", "since", "yesterday", "today"])
                if not has_duration:
                    questions.append({"question": fq["question"], "quick_replies": fq["quick_replies"]})
            else:
                questions.append({"question": fq["question"], "quick_replies": fq["quick_replies"]})

        if len(questions) >= 3:
            break

    return questions


def _get_self_care(conditions: List[Dict[str, Any]], urgency: str) -> Dict[str, Any]:
    """Generate self-care guidance based on detected conditions."""
    if urgency == "emergency":
        return {
            "immediate": ["Call emergency services (112) immediately", "Do not drive yourself", "Stay calm and lie down if possible"],
            "otc_meds": ["Do not take any medication without medical guidance in emergencies"],
            "warning_signs": ["This is already an emergency. Get help now."],
        }

    if not conditions:
        return DEFAULT_SELF_CARE

    # Use guidance from the top condition
    top_condition = conditions[0]["label"]
    guidance = SELF_CARE_GUIDANCE.get(top_condition, DEFAULT_SELF_CARE)
    return guidance


def _get_food_guidance(conditions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate food/nutrition guidance based on affected body systems."""
    if not conditions:
        return DEFAULT_FOOD_GUIDANCE

    # Get the body system of the top condition
    top_condition = conditions[0]["label"]
    body_system = CONDITION_BODY_SYSTEM.get(top_condition, "")
    guidance = FOOD_GUIDANCE.get(body_system, DEFAULT_FOOD_GUIDANCE)
    return guidance


def _get_specialists(conditions: List[Dict[str, Any]]) -> List[str]:
    """Get recommended specialists from conditions."""
    specialists = []
    seen = set()
    for c in conditions[:3]:  # top 3 conditions
        spec = CONDITION_SPECIALIST.get(c["label"], "General Physician")
        if spec not in seen:
            seen.add(spec)
            specialists.append(spec)
    if not specialists:
        specialists = ["General Physician"]
    return specialists


def _generate_recovery_plan(conditions: List[Dict[str, Any]], urgency: str) -> Dict[str, Any]:
    """Generate a basic recovery plan based on conditions and severity."""
    if not conditions:
        return {}

    top_condition = conditions[0]["label"]
    body_system = CONDITION_BODY_SYSTEM.get(top_condition, "General")

    # Generic plans based on urgency / body system
    if urgency in ("emergency", "high"):
        return {
            "week_1": {
                "goals": ["Get professional medical evaluation", "Follow prescribed treatment", "Complete bed rest as needed"],
                "actions": ["Visit doctor within 24 hours", "Take prescribed medications on time", "Monitor vital signs daily", "Keep a symptom diary"],
            },
            "month_1": {
                "goals": ["Complete prescribed treatment course", "See improvement in symptoms", "Follow-up with doctor"],
                "actions": ["Follow-up visit in 1-2 weeks", "Continue medications as prescribed", "Gradually resume light activities", "Maintain healthy diet"],
            },
            "month_6": {
                "goals": ["Full recovery or stable management", "Build healthier lifestyle habits", "Prevent recurrence"],
                "actions": ["Regular health checkups", "Maintain exercise routine (30 min/day)", "Balanced diet as recommended", "Manage stress levels"],
            },
            "year_1": {
                "goals": ["Long-term health maintenance", "Establish preventive care routine", "Optimal fitness and wellness"],
                "actions": ["Annual comprehensive health checkup", "Continue healthy diet and exercise", "Preventive screenings as recommended", "Mental health check-in"],
            },
        }

    return {
        "week_1": {
            "goals": ["Symptom relief and rest", "Hydration and nutrition", "Monitor for any worsening"],
            "actions": ["Rest adequately (8+ hours sleep)", "Stay hydrated (8-10 glasses water)", "Eat light, nutritious meals", "Track symptoms daily"],
        },
        "month_1": {
            "goals": ["Complete resolution of symptoms", "Return to normal activities", "Strengthen immunity"],
            "actions": ["Gradually increase activity level", "Include immune-boosting foods", "Establish regular sleep schedule", "Visit doctor if symptoms persist"],
        },
        "month_6": {
            "goals": ["Build resilience", "Healthy lifestyle habits", "Prevent recurrence"],
            "actions": ["Regular exercise 150 min/week", "Balanced diet rich in fruits and vegetables", "Annual health checkup", "Stress management practices"],
        },
        "year_1": {
            "goals": ["Optimal health", "Preventive care", "Strong immunity"],
            "actions": ["Maintain healthy BMI", "Regular preventive screenings", "Consistent exercise routine", "Annual flu vaccination"],
        },
    }


# ── Rule-based fallback ───────────────────────────────────────────────────────
KEYWORD_RULES: List[Dict] = [
    {"keywords": ["fever", "headache", "body ache", "muscle pain"],         "condition": "Influenza (flu)",        "score": 0.80},
    {"keywords": ["fever", "rash", "joint pain", "behind eyes"],            "condition": "Dengue fever",           "score": 0.78},
    {"keywords": ["cough", "cold", "runny nose", "sneezing"],               "condition": "Common cold",            "score": 0.82},
    {"keywords": ["chest pain", "shortness of breath", "sweating"],         "condition": "Heart attack (Myocardial infarction)", "score": 0.85},
    {"keywords": ["chest tightness", "wheeze", "cough at night"],           "condition": "Asthma",                 "score": 0.79},
    {"keywords": ["increased thirst", "frequent urination", "fatigue"],     "condition": "Type 2 diabetes",        "score": 0.76},
    {"keywords": ["nausea", "vomiting", "diarrhoea", "stomach pain"],       "condition": "Gastroenteritis",        "score": 0.80},
    {"keywords": ["burning urination", "frequent urination", "back pain"],  "condition": "Urinary tract infection (UTI)", "score": 0.82},
    {"keywords": ["severe headache", "nausea", "light sensitivity"],        "condition": "Migraine",               "score": 0.78},
    {"keywords": ["fatigue", "pale", "dizziness", "weakness"],              "condition": "Anemia",                 "score": 0.73},
    {"keywords": ["weight gain", "fatigue", "cold intolerance", "hair loss"], "condition": "Hypothyroidism",       "score": 0.74},
    {"keywords": ["jaundice", "abdominal pain", "dark urine"],              "condition": "Liver disease",          "score": 0.77},
    {"keywords": ["sharp abdominal pain", "right side", "nausea"],          "condition": "Appendicitis",           "score": 0.72},
    {"keywords": ["sadness", "hopeless", "no interest", "sleep problems"],  "condition": "Depression",             "score": 0.74},
    {"keywords": ["worry", "panic", "racing heart", "restless"],            "condition": "Anxiety disorder",       "score": 0.72},
    {"keywords": ["cough", "fever", "night sweats", "weight loss"],         "condition": "Tuberculosis",           "score": 0.76},
    {"keywords": ["heartburn", "acid", "chest burn", "regurgitation"],      "condition": "Acid reflux (GERD)",     "score": 0.77},
    {"keywords": ["flank pain", "severe pain", "blood in urine"],           "condition": "Kidney stones",          "score": 0.75},
    {"keywords": ["itching", "rash", "red skin", "swelling"],              "condition": "Allergic reaction",       "score": 0.73},
    {"keywords": ["eye redness", "discharge", "itchy eyes"],                "condition": "Conjunctivitis (Pink eye)", "score": 0.76},
]


def _rule_based_classify(text: str) -> List[Dict[str, Any]]:
    t = text.lower()
    results = []
    for rule in KEYWORD_RULES:
        matched = sum(1 for kw in rule["keywords"] if kw in t)
        if matched >= 2:
            score = rule["score"] * (matched / len(rule["keywords"]))
            results.append({"label": rule["condition"], "score": round(score, 3)})
    results.sort(key=lambda x: -x["score"])
    if not results:
        results = [
            {"label": "General illness requiring evaluation", "score": 0.60},
            {"label": "Viral infection", "score": 0.55},
        ]
    return results[:6]


# ── Main class ────────────────────────────────────────────────────────────────
class SymptomAnalyzer:
    def __init__(self):
        self.pipe = None
        try:
            from transformers import pipeline
            logger.info("Loading NLP model: facebook/bart-large-mnli ...")
            self.pipe = pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
                device=-1,  # CPU
            )
            logger.info("NLP model loaded")
        except Exception as e:
            logger.warning(f"NLP model unavailable ({e}). Using rule-based fallback.")

    def analyze(self, symptoms: str) -> dict:
        """
        Full symptom analysis pipeline.
        Returns comprehensive results for the multi-section frontend.
        """
        urgency = _detect_urgency(symptoms)

        # Classify conditions
        if self.pipe:
            try:
                result = self.pipe(
                    symptoms,
                    candidate_labels=CANDIDATE_CONDITIONS,
                    multi_label=True,
                )
                conditions = [
                    {"label": lbl, "score": round(scr, 3)}
                    for lbl, scr in zip(result["labels"], result["scores"])
                    if scr > 0.10
                ][:6]
            except Exception as e:
                logger.error(f"NLP inference error: {e}")
                conditions = _rule_based_classify(symptoms)
        else:
            conditions = _rule_based_classify(symptoms)

        # Enrich conditions with body system info
        for c in conditions:
            c["body_system"] = CONDITION_BODY_SYSTEM.get(c["label"], "General")

        # Generate all guidance
        self_care = _get_self_care(conditions, urgency)
        food_guidance = _get_food_guidance(conditions)
        specialists = _get_specialists(conditions)
        recovery_plan = _generate_recovery_plan(conditions, urgency)
        follow_up_questions = _get_follow_up_questions(symptoms)

        # Get affected body systems
        body_systems = list(set(c.get("body_system", "General") for c in conditions))

        return {
            "conditions":         conditions,
            "urgency":            urgency,
            "recommendation":     _urgency_recommendation(urgency),
            "body_systems":       body_systems,
            "self_care":          self_care,
            "food_guidance":      food_guidance,
            "specialists":        specialists,
            "recovery_plan":      recovery_plan,
            "follow_up_questions": follow_up_questions,
            "disclaimer": (
                "This is an AI-generated analysis for informational purposes only. "
                "It does NOT constitute a medical diagnosis. Please consult a qualified doctor."
            ),
        }
