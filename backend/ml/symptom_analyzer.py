# backend/ml/symptom_analyzer.py
"""
Symptom Analyzer — Category-Driven Medical Reasoning Engine (v3)
================================================================
A redesign that fixes three problems with the old zero-shot approach:

  1. Repetitive generic follow-up questions  → dynamic, body-system-aware
     questions (leg pain asks about injury/swelling, not diabetes/asthma).
  2. COVID-19 over-prediction                → conditions are now constrained
     to the body systems actually detected in the user's text. COVID only
     appears on a genuine COVID-like symptom cluster.
  3. One-shot prediction                     → returns an `analysis_confidence`
     signal so the UI can drive a progressive "refine" loop.

How it works
------------
  text → detect body-system categories (keyword scoring)
       → generate category-consistent candidate conditions (+ modifiers)
       → (optional) re-rank with BART zero-shot *within* those labels
       → enrich with body system / specialist / self-care / food / recovery
       → produce dynamic, context-aware follow-up questions

The transformers/torch pipeline is fully optional — if it isn't installed
(e.g. on a free-tier deploy) the deterministic category engine carries the
whole feature. This keeps predictions medically believable either way.
"""
from __future__ import annotations
import logging, re
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════
#  1. SYMPTOM → BODY-SYSTEM CATEGORY DETECTION
# ═══════════════════════════════════════════════════════════════════════════
# Each category holds keyword/phrase triggers. Multi-word phrases are weighted
# higher (more specific) than single tokens during scoring.
SYMPTOM_CATEGORIES: Dict[str, List[str]] = {
    "Musculoskeletal": [
        "leg pain", "knee pain", "joint pain", "muscle pain", "back pain",
        "low back pain", "arm pain", "shoulder pain", "ankle pain", "hip pain",
        "wrist pain", "elbow pain", "neck pain", "body ache", "ache all over",
        "stiffness", "sprain", "strain", "cramp", "spasm", "bone", "muscle",
        "joint", "knee", "ankle", "shoulder", "swollen joint", "limp",
    ],
    "Respiratory": [
        "cough", "shortness of breath", "difficulty breathing", "breathless",
        "wheeze", "wheezing", "chest congestion", "congestion in chest",
        "sore throat", "runny nose", "nasal congestion", "sneezing", "phlegm",
        "sputum", "coughing up", "hoarse voice", "breathing fast", "stuffy nose",
    ],
    "Cardiovascular": [
        "chest pain", "chest tightness", "palpitation", "palpitations",
        "irregular heartbeat", "racing heart", "heart pounding", "fast heartbeat",
        "pain radiating to arm", "left arm pain", "heart",
    ],
    "Neurological": [
        "headache", "migraine", "dizziness", "dizzy", "vertigo", "numbness",
        "tingling", "loss of sensation", "memory", "confusion", "seizure",
        "fainting", "slurred speech", "weakness on one side", "pins and needles",
    ],
    "Digestive": [
        "stomach pain", "abdominal pain", "stomach ache", "belly pain", "nausea",
        "vomiting", "diarrhea", "diarrhoea", "constipation", "bloating",
        "heartburn", "indigestion", "acid reflux", "gas", "flatulence",
        "blood in stool", "loss of appetite", "stomach", "abdomen", "cramping",
    ],
    "Urinary": [
        "painful urination", "burning urination", "frequent urination",
        "blood in urine", "urine", "urinary", "bladder", "flank pain",
        "kidney pain", "cannot urinate", "cloudy urine",
    ],
    "Skin": [
        "rash", "itching", "itchy skin", "skin lesion", "acne", "pimples",
        "hives", "skin growth", "mole", "skin redness", "skin swelling",
        "blister", "dry skin", "skin infection", "skin",
    ],
    "Mental Health": [
        "anxiety", "anxious", "depression", "depressed", "panic", "stress",
        "stressed", "worry", "worried", "sadness", "hopeless", "low mood",
        "insomnia", "can't sleep", "nervous", "restless",
    ],
    "ENT/Eyes": [
        "ear pain", "earache", "ringing in ear", "hearing", "eye pain",
        "eye redness", "blurred vision", "double vision", "vision", "sinus",
        "sinus pain", "sinus congestion", "itchy eye", "watery eye",
    ],
    "Endocrine": [
        "increased thirst", "excessive thirst", "frequent urination and thirst",
        "weight gain", "weight loss", "cold intolerance", "heat intolerance",
        "hair loss", "fatigue and thirst",
    ],
    "Infectious/General": [
        "fever", "high fever", "chills", "fatigue", "tired", "tiredness",
        "weakness", "sweating", "night sweats", "feeling ill", "malaise",
        "feeling unwell", "flu-like",
    ],
}

# ═══════════════════════════════════════════════════════════════════════════
#  2. DYNAMIC, CONTEXT-AWARE FOLLOW-UP QUESTIONS (per category)
# ═══════════════════════════════════════════════════════════════════════════
CATEGORY_FOLLOWUP_QUESTIONS: Dict[str, List[Dict[str, Any]]] = {
    "Musculoskeletal": [
        {"question": "Did you injure, strain, or overuse that area recently?",
         "quick_replies": ["Recent injury", "Overuse / strain", "No injury", "Past surgery there"]},
        {"question": "How would you describe the pain?",
         "quick_replies": ["Sharp / stabbing", "Dull / aching", "Throbbing", "Burning / tingling"]},
        {"question": "Is there any swelling, redness, or warmth in the area?",
         "quick_replies": ["Swelling", "Redness / warmth", "Both", "Neither"]},
        {"question": "Does the pain change with movement?",
         "quick_replies": ["Worse when moving", "Worse when walking", "Worse at rest", "No change"]},
    ],
    "Respiratory": [
        {"question": "Is your cough dry or bringing up mucus/phlegm?",
         "quick_replies": ["Dry cough", "Mucus / phlegm", "Blood in mucus", "No cough"]},
        {"question": "Do you feel short of breath?",
         "quick_replies": ["At rest", "Only on exertion", "When lying down", "No"]},
        {"question": "Any fever or sore throat along with it?",
         "quick_replies": ["Fever", "Sore throat", "Both", "Neither"]},
        {"question": "Have you lost your sense of taste or smell?",
         "quick_replies": ["Yes", "No", "Reduced", "Not sure"]},
    ],
    "Cardiovascular": [
        {"question": "Does the chest discomfort spread to your arm, jaw, or back?",
         "quick_replies": ["Yes, to left arm", "To jaw / back", "Stays in chest", "No"]},
        {"question": "Is it triggered by exertion or stress?",
         "quick_replies": ["With exertion", "With stress", "At rest too", "Random"]},
        {"question": "Any sweating, nausea, or breathlessness with it?",
         "quick_replies": ["Sweating", "Nausea", "Breathless", "None of these"]},
    ],
    "Neurological": [
        {"question": "How would you describe the headache/sensation?",
         "quick_replies": ["Throbbing / one side", "Tight band", "Sudden & severe", "Dull constant"]},
        {"question": "Any light/sound sensitivity, nausea, or vision changes?",
         "quick_replies": ["Light/sound", "Nausea", "Vision changes", "None"]},
        {"question": "Is it linked to stress, screen time, or poor sleep?",
         "quick_replies": ["Stress", "Screen time", "Poor sleep", "Not sure"]},
    ],
    "Digestive": [
        {"question": "Where is the discomfort mainly located?",
         "quick_replies": ["Upper abdomen", "Lower abdomen", "Right side", "All over"]},
        {"question": "Is it related to eating?",
         "quick_replies": ["Worse after eating", "Better after eating", "On empty stomach", "No pattern"]},
        {"question": "Any nausea, vomiting, or change in bowel habits?",
         "quick_replies": ["Nausea/vomiting", "Diarrhea", "Constipation", "None"]},
    ],
    "Urinary": [
        {"question": "Do you feel burning or pain while urinating?",
         "quick_replies": ["Yes, burning", "Frequent urge", "Both", "No"]},
        {"question": "Any fever or pain in your back/sides (flank)?",
         "quick_replies": ["Fever", "Flank pain", "Both", "Neither"]},
        {"question": "Have you noticed blood or cloudiness in your urine?",
         "quick_replies": ["Blood", "Cloudy", "Strong odor", "No"]},
    ],
    "Skin": [
        {"question": "Is the affected skin itchy, painful, or spreading?",
         "quick_replies": ["Itchy", "Painful", "Spreading", "None of these"]},
        {"question": "Did it start after a new food, product, or medication?",
         "quick_replies": ["New food", "New product", "New medication", "No / unsure"]},
        {"question": "Any swelling, blistering, or oozing?",
         "quick_replies": ["Swelling", "Blisters", "Oozing", "Neither"]},
    ],
    "Mental Health": [
        {"question": "How long have you been feeling this way?",
         "quick_replies": ["A few days", "A few weeks", "Months", "On and off"]},
        {"question": "Is it affecting your sleep, appetite, or daily activities?",
         "quick_replies": ["Sleep", "Appetite", "Daily activities", "All of these"]},
        {"question": "Do you have a support system you can talk to?",
         "quick_replies": ["Yes", "Somewhat", "Not really", "Prefer not to say"]},
    ],
    "ENT/Eyes": [
        {"question": "Is there pain, discharge, or reduced function (hearing/vision)?",
         "quick_replies": ["Pain", "Discharge", "Reduced hearing/vision", "Just irritation"]},
        {"question": "Did it follow a cold, allergy, or infection?",
         "quick_replies": ["After a cold", "Allergy", "Infection", "Came on its own"]},
    ],
    "Endocrine": [
        {"question": "Have you noticed changes in thirst, urination, or weight?",
         "quick_replies": ["More thirst/urination", "Weight change", "Both", "No"]},
        {"question": "Any unusual fatigue, or heat/cold intolerance?",
         "quick_replies": ["Fatigue", "Heat intolerance", "Cold intolerance", "No"]},
    ],
    "Infectious/General": [
        {"question": "How high is the fever and how long has it lasted?",
         "quick_replies": ["Mild, 1-2 days", "Moderate, few days", "High, persistent", "No thermometer"]},
        {"question": "Any localizing symptoms (cough, urine, stomach, rash)?",
         "quick_replies": ["Cough", "Urinary", "Stomach", "Rash"]},
        {"question": "Have you traveled recently or been around someone sick?",
         "quick_replies": ["Recent travel", "Around someone ill", "Both", "Neither"]},
    ],
}

# A single duration question used when the user hasn't mentioned a timeframe.
DURATION_QUESTION = {
    "question": "How long have you been experiencing this?",
    "quick_replies": ["Less than a day", "1-3 days", "About a week", "More than a week"],
}

# Asked when we cannot detect any category (vague/short input).
CLARIFY_QUESTION = {
    "question": "Could you tell me a bit more about your main symptom and where you feel it?",
    "quick_replies": ["Pain somewhere", "Fever / unwell", "Breathing issue", "Stomach issue"],
}

# ═══════════════════════════════════════════════════════════════════════════
#  3. CATEGORY → MEDICALLY-RELEVANT CANDIDATE CONDITIONS
# ═══════════════════════════════════════════════════════════════════════════
# `base` is the prior confidence before symptom-count / modifier adjustments.
# `system` is the body system used for icons, food guidance and specialists.
CATEGORY_CONDITIONS: Dict[str, List[Dict[str, Any]]] = {
    "Musculoskeletal": [
        {"label": "Muscle strain or sprain",            "base": 0.70, "system": "Musculoskeletal"},
        {"label": "Joint inflammation / arthritis",     "base": 0.52, "system": "Musculoskeletal"},
        {"label": "Nerve compression (e.g. sciatica)",  "base": 0.44, "system": "Neurological"},
        {"label": "Tendinitis / overuse injury",        "base": 0.40, "system": "Musculoskeletal"},
    ],
    "Respiratory": [
        {"label": "Common cold / upper respiratory infection", "base": 0.66, "system": "Respiratory"},
        {"label": "Acute bronchitis",                          "base": 0.50, "system": "Respiratory"},
        {"label": "Influenza (flu)",                           "base": 0.46, "system": "Respiratory"},
        {"label": "Asthma / reactive airway",                  "base": 0.36, "system": "Respiratory"},
    ],
    "Cardiovascular": [
        {"label": "Angina (cardiac chest pain)",         "base": 0.55, "system": "Cardiovascular"},
        {"label": "Hypertension-related symptoms",       "base": 0.42, "system": "Cardiovascular"},
        {"label": "Arrhythmia (irregular heartbeat)",    "base": 0.40, "system": "Cardiovascular"},
        {"label": "Anxiety-related chest discomfort",    "base": 0.34, "system": "Mental Health"},
    ],
    "Neurological": [
        {"label": "Tension headache",                "base": 0.62, "system": "Neurological"},
        {"label": "Migraine",                        "base": 0.50, "system": "Neurological"},
        {"label": "Stress / anxiety-related",        "base": 0.38, "system": "Mental Health"},
        {"label": "Dehydration / fatigue",           "base": 0.34, "system": "General"},
    ],
    "Digestive": [
        {"label": "Acid reflux / gastritis (GERD)",  "base": 0.60, "system": "Digestive"},
        {"label": "Gastroenteritis (stomach bug)",   "base": 0.52, "system": "Digestive"},
        {"label": "Irritable bowel syndrome (IBS)",  "base": 0.40, "system": "Digestive"},
        {"label": "Indigestion / food intolerance",  "base": 0.36, "system": "Digestive"},
    ],
    "Urinary": [
        {"label": "Urinary tract infection (UTI)",   "base": 0.64, "system": "Urinary"},
        {"label": "Kidney stones",                   "base": 0.42, "system": "Urinary"},
        {"label": "Bladder irritation",              "base": 0.34, "system": "Urinary"},
    ],
    "Skin": [
        {"label": "Allergic reaction / contact dermatitis", "base": 0.58, "system": "Skin"},
        {"label": "Skin infection",                         "base": 0.42, "system": "Skin"},
        {"label": "Eczema or psoriasis",                    "base": 0.36, "system": "Skin"},
    ],
    "Mental Health": [
        {"label": "Anxiety-related symptoms",   "base": 0.58, "system": "Mental Health"},
        {"label": "Stress / burnout",           "base": 0.46, "system": "Mental Health"},
        {"label": "Depression",                 "base": 0.40, "system": "Mental Health"},
    ],
    "ENT/Eyes": [
        {"label": "Sinusitis / ENT infection",       "base": 0.55, "system": "Respiratory"},
        {"label": "Conjunctivitis / eye irritation", "base": 0.42, "system": "Eyes"},
        {"label": "Ear infection",                   "base": 0.40, "system": "General"},
    ],
    "Endocrine": [
        {"label": "Possible blood-sugar imbalance",  "base": 0.50, "system": "Endocrine"},
        {"label": "Thyroid-related symptoms",        "base": 0.42, "system": "Endocrine"},
        {"label": "Type 2 diabetes risk",            "base": 0.38, "system": "Endocrine"},
    ],
    "Infectious/General": [
        {"label": "Viral infection",         "base": 0.58, "system": "Infectious"},
        {"label": "Influenza (flu)",         "base": 0.46, "system": "Respiratory"},
        {"label": "General fatigue / run-down state", "base": 0.34, "system": "General"},
    ],
}

# ═══════════════════════════════════════════════════════════════════════════
#  4. EXISTING ENRICHMENT DATA (body systems, specialists, self-care, food)
# ═══════════════════════════════════════════════════════════════════════════
# Kept for BART candidate labels + lookups. Conditions returned by the engine
# already carry their own `body_system`, so these are best-effort fallbacks.
CANDIDATE_CONDITIONS = [
    "Common cold", "Influenza (flu)", "COVID-19", "Dengue fever", "Malaria",
    "Pneumonia", "Asthma", "Migraine", "Tension headache",
    "Urinary tract infection (UTI)", "Gastroenteritis", "Acid reflux (GERD)",
    "Anxiety disorder", "Depression", "Allergic reaction", "Dermatitis",
    "Conjunctivitis (Pink eye)", "Sinusitis", "Bronchitis",
]

CONDITION_BODY_SYSTEM = {
    "Common cold": "Respiratory", "Influenza (flu)": "Respiratory",
    "COVID-19": "Respiratory", "Pneumonia": "Respiratory", "Asthma": "Respiratory",
    "Bronchitis": "Respiratory", "Sinusitis": "Respiratory",
    "Dengue fever": "Infectious", "Malaria": "Infectious",
    "Migraine": "Neurological", "Tension headache": "Neurological",
    "Gastroenteritis": "Digestive", "Acid reflux (GERD)": "Digestive",
    "Urinary tract infection (UTI)": "Urinary",
    "Anxiety disorder": "Mental Health", "Depression": "Mental Health",
    "Allergic reaction": "Immune", "Dermatitis": "Skin",
    "Conjunctivitis (Pink eye)": "Eyes",
}

# Body system → default specialist (covers all engine conditions)
SYSTEM_SPECIALIST = {
    "Respiratory":     "Pulmonologist",
    "Cardiovascular":  "Cardiologist",
    "Neurological":    "Neurologist",
    "Digestive":       "Gastroenterologist",
    "Endocrine":       "Endocrinologist",
    "Urinary":         "Urologist",
    "Skin":            "Dermatologist",
    "Mental Health":   "Psychiatrist",
    "Musculoskeletal": "Orthopedist",
    "Hematological":   "Hematologist",
    "Infectious":      "Internal Medicine",
    "Immune":          "Allergist",
    "Eyes":            "Ophthalmologist",
    "General":         "General Physician",
}

SELF_CARE_GUIDANCE = {
    "Common cold / upper respiratory infection": {
        "immediate": ["Rest at home", "Stay hydrated with warm fluids", "Gargle with warm salt water"],
        "otc_meds": ["Paracetamol for fever/pain", "Nasal decongestant", "Steam inhalation"],
        "warning_signs": ["Fever above 103F for 3+ days", "Difficulty breathing", "Chest pain"],
    },
    "Influenza (flu)": {
        "immediate": ["Bed rest for 3-5 days", "Hydrate with water, soups, ORS", "Isolate to avoid spread"],
        "otc_meds": ["Paracetamol for fever", "Antihistamine for runny nose"],
        "warning_signs": ["Severe breathlessness", "Confusion or dizziness", "Persistent vomiting"],
    },
    "Migraine": {
        "immediate": ["Rest in a dark, quiet room", "Cold compress to forehead", "Avoid screens & bright light"],
        "otc_meds": ["Ibuprofen or aspirin (taken early)", "Anti-nausea medicine if needed"],
        "warning_signs": ["Worst headache of your life", "Sudden onset with stiff neck", "Vision loss or speech difficulty"],
    },
    "Tension headache": {
        "immediate": ["Take a screen break and rest your eyes", "Gentle neck/shoulder stretches", "Hydrate and reduce stress"],
        "otc_meds": ["Paracetamol or ibuprofen", "Warm compress on neck"],
        "warning_signs": ["Sudden severe headache", "Headache with fever & stiff neck", "Weakness or numbness"],
    },
    "Gastroenteritis (stomach bug)": {
        "immediate": ["Oral rehydration solution (ORS)", "BRAT diet: banana, rice, applesauce, toast", "Small frequent sips of fluid"],
        "otc_meds": ["ORS packets", "Probiotics after the acute phase"],
        "warning_signs": ["Blood in stool or vomit", "Cannot keep fluids down 24h", "Signs of dehydration"],
    },
    "Urinary tract infection (UTI)": {
        "immediate": ["Drink plenty of water (3L+/day)", "Avoid caffeine and alcohol", "Maintain good hygiene"],
        "otc_meds": ["Paracetamol for pain", "Cranberry supplements may help"],
        "warning_signs": ["High fever with chills", "Severe flank/back pain", "Blood in urine"],
    },
    "Muscle strain or sprain": {
        "immediate": ["Follow R.I.C.E. — Rest, Ice, Compression, Elevation", "Avoid loading the injured area", "Gentle movement once pain eases"],
        "otc_meds": ["Ibuprofen for pain & swelling", "Topical analgesic gel"],
        "warning_signs": ["Inability to bear weight", "Severe swelling or deformity", "Numbness below the injury"],
    },
    "Anxiety-related symptoms": {
        "immediate": ["Slow breathing: 4-7-8 technique", "5-4-3-2-1 grounding exercise", "Step away from the stressor"],
        "otc_meds": ["Avoid self-medication", "Consider professional support"],
        "warning_signs": ["Panic attacks over 30 min", "Thoughts of self-harm", "Unable to function daily"],
    },
}

DEFAULT_SELF_CARE = {
    "immediate": ["Rest and avoid overexertion", "Stay well hydrated", "Monitor symptoms closely"],
    "otc_meds": ["Paracetamol for pain/fever if needed", "Ask a pharmacist for suitable options"],
    "warning_signs": ["Symptoms worsening rapidly", "High fever not responding to medication", "New severe symptoms appearing"],
}

FOOD_GUIDANCE = {
    "Respiratory": {
        "healing_foods": ["Ginger tea", "Honey with warm water", "Citrus fruits (vitamin C)", "Garlic", "Turmeric milk", "Steamed vegetables"],
        "avoid_foods": ["Cold drinks & ice cream", "Excess dairy", "Fried/oily food", "Sugary drinks"],
        "hydration": "Warm fluids every 2 hours: herbal tea, warm lemon water, clear soups",
    },
    "Digestive": {
        "healing_foods": ["Khichdi (rice & dal)", "Banana & papaya", "Curd/yogurt (probiotics)", "Coconut water", "Boiled potatoes", "Toast"],
        "avoid_foods": ["Spicy food", "Fried/greasy food", "Raw veg initially", "Caffeine & alcohol"],
        "hydration": "ORS, coconut water, buttermilk — small frequent sips",
    },
    "Cardiovascular": {
        "healing_foods": ["Oats & whole grains", "Leafy greens", "Fatty fish (omega-3)", "Nuts & seeds", "Berries", "Olive oil"],
        "avoid_foods": ["Excess salt", "Red & processed meat", "Trans fats", "Sugary desserts"],
        "hydration": "6-8 glasses of water daily. Limit caffeine. Green tea is fine.",
    },
    "Endocrine": {
        "healing_foods": ["Whole grains", "Lean protein", "Green vegetables", "Nuts & seeds", "Low-GI fruit", "Fenugreek seeds"],
        "avoid_foods": ["White rice & maida", "Sugary drinks & sweets", "Processed food", "Fruit juices"],
        "hydration": "Plenty of water. Jeera water aids digestion. Avoid sugary drinks.",
    },
    "Neurological": {
        "healing_foods": ["Leafy greens", "Fatty fish (omega-3)", "Walnuts", "Berries", "Pumpkin seeds (magnesium)", "Dark chocolate (small)"],
        "avoid_foods": ["Aged cheese", "Processed meats", "Alcohol", "Excess caffeine", "MSG", "Artificial sweeteners"],
        "hydration": "Stay well hydrated — dehydration triggers headaches. 8+ glasses/day.",
    },
    "Mental Health": {
        "healing_foods": ["Fatty fish & walnuts (omega-3)", "Leafy greens (folate)", "Fermented foods", "Whole grains", "Bananas", "Dark chocolate (small)"],
        "avoid_foods": ["Excess caffeine", "Alcohol", "Refined sugar", "Processed junk food", "Energy drinks"],
        "hydration": "Regular water. Chamomile tea at bedtime. Limit coffee to mornings.",
    },
    "Urinary": {
        "healing_foods": ["Cranberries & blueberries", "Watermelon", "Cucumber", "Yogurt (probiotics)", "Barley water", "Coconut water"],
        "avoid_foods": ["Spicy food", "Caffeine", "Alcohol", "Carbonated drinks"],
        "hydration": "Critical: 3L+ water daily. Barley water, coconut water, cranberry juice.",
    },
    "Musculoskeletal": {
        "healing_foods": ["Calcium-rich dairy", "Leafy greens", "Fatty fish (omega-3)", "Eggs (vitamin D)", "Nuts", "Turmeric"],
        "avoid_foods": ["Excess salt", "Sugary foods (inflammation)", "Processed food", "Excess alcohol"],
        "hydration": "Stay hydrated to keep joints lubricated. 8+ glasses/day.",
    },
    "Skin": {
        "healing_foods": ["Water-rich fruits", "Leafy greens", "Omega-3 fish", "Nuts & seeds", "Yogurt (probiotics)", "Green tea"],
        "avoid_foods": ["Known allergens", "Excess sugar & dairy", "Fried food", "Alcohol"],
        "hydration": "Hydrate well to support skin barrier. 8-10 glasses/day.",
    },
}

DEFAULT_FOOD_GUIDANCE = {
    "healing_foods": ["Fresh fruits & vegetables", "Whole grains", "Lean protein", "Nuts & seeds", "Yogurt", "Green tea"],
    "avoid_foods": ["Fried & processed foods", "Excess sugar", "Alcohol", "Excess caffeine"],
    "hydration": "Stay well hydrated with 8-10 glasses of water daily. Include herbal teas.",
}

# ═══════════════════════════════════════════════════════════════════════════
#  5. URGENCY / SEVERITY DETECTION
# ═══════════════════════════════════════════════════════════════════════════
EMERGENCY_KEYWORDS = [
    "chest pain radiating", "can't breathe", "cannot breathe", "unconscious",
    "stroke", "paralysis", "severe bleeding", "heart attack",
    "loss of consciousness", "seizure", "convulsions", "sudden numbness",
    "suicidal", "self harm", "want to die", "worst headache of my life",
    "coughing up blood", "blue lips",
]
HIGH_KEYWORDS = [
    "high fever", "vomiting blood", "blood in stool", "severe headache",
    "confusion", "hallucination", "jaundice", "swollen throat",
    "difficulty swallowing", "severe abdominal pain", "shortness of breath",
    "chest pain", "blood in urine", "fainting",
]
MEDIUM_KEYWORDS = [
    "fever", "vomiting", "diarrhea", "diarrhoea", "rash", "cough",
    "fatigue", "weakness", "dizziness", "nausea", "persistent",
    "burning", "pain", "swelling", "stiffness",
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
        "low":       "Monitor symptoms. Consult a doctor if they persist beyond 3-5 days.",
    }[urgency]


# ═══════════════════════════════════════════════════════════════════════════
#  6. CORE ENGINE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════
def _detect_categories(text: str) -> List[Tuple[str, float]]:
    """
    Score each body-system category by keyword matches in the text.
    Multi-word phrases score 2.0 (specific), single words score 1.0.
    Returns [(category, score), ...] sorted by score desc (score > 0 only).
    """
    t = " " + text.lower().strip() + " "
    scores: Dict[str, float] = {}
    for category, keywords in SYMPTOM_CATEGORIES.items():
        s = 0.0
        for kw in keywords:
            if kw in t:
                s += 2.0 if " " in kw else 1.0
        if s > 0:
            scores[category] = s
    return sorted(scores.items(), key=lambda kv: -kv[1])


def _apply_modifiers(text: str, conditions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Boost/insert conditions based on specific symptom combinations so the
    reasoning feels clinically aware."""
    t = text.lower()

    def boost(label_sub: str, delta: float):
        for c in conditions:
            if label_sub.lower() in c["label"].lower():
                c["score"] = min(0.96, c["score"] + delta)

    # Musculoskeletal red flags
    if ("swelling" in t or "swollen" in t) and ("red" in t or "warm" in t) and ("leg" in t or "calf" in t):
        conditions.append({"label": "Possible deep vein thrombosis (DVT) — needs urgent review",
                            "score": 0.55, "body_system": "Cardiovascular"})
    if any(w in t for w in ["injury", "injured", "fell", "twist", "sprain", "strain", "lifting"]):
        boost("strain or sprain", 0.12)
    if "burning" in t or "tingling" in t or "shooting" in t:
        boost("nerve compression", 0.12)

    # Cardiovascular red flags
    if "chest pain" in t and any(w in t for w in ["left arm", "jaw", "sweating", "radiat"]):
        boost("angina", 0.18)

    # Digestive specificity
    if "right" in t and ("lower" in t or "lower abdomen" in t) and any(w in t for w in ["pain", "ache"]):
        conditions.append({"label": "Possible appendicitis — seek prompt evaluation",
                            "score": 0.50, "body_system": "Digestive"})

    # Respiratory severity
    if "blood" in t and ("cough" in t or "sputum" in t or "phlegm" in t):
        conditions.append({"label": "Lower respiratory infection (needs evaluation)",
                            "score": 0.52, "body_system": "Respiratory"})

    return conditions


def _maybe_add_covid(text: str, conditions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """COVID-19 is ONLY added when a genuine COVID-like cluster is present.
    This is the core fix for COVID over-prediction."""
    t = text.lower()
    signals = sum([
        "fever" in t,
        ("cough" in t or "breath" in t or "breathless" in t),
        ("loss of taste" in t or "loss of smell" in t or "smell" in t or "taste" in t),
        "sore throat" in t,
        ("body ache" in t or "fatigue" in t or "tired" in t),
    ])
    if signals >= 3:
        conditions.append({"label": "COVID-19 (consider testing)",
                           "score": min(0.6, 0.30 + 0.08 * signals), "body_system": "Respiratory"})
    return conditions


def _classify_by_category(text: str, detected: List[Tuple[str, float]]) -> List[Dict[str, Any]]:
    """Build category-consistent candidate conditions with confidence scoring."""
    if not detected:
        return [
            {"label": "General symptoms requiring evaluation", "score": 0.45, "system": "General"},
            {"label": "Possible viral infection",              "score": 0.38, "system": "Infectious"},
        ]

    total = sum(s for _, s in detected) or 1.0
    conditions: List[Dict[str, Any]] = []
    seen: set = set()

    for category, score in detected:
        prominence = score / total                      # 0..1 share of this category
        for cond in CATEGORY_CONDITIONS.get(category, []):
            if cond["label"] in seen:
                continue
            seen.add(cond["label"])
            # Confidence scales with how prominent the category is in the text.
            adj = cond["base"] * (0.62 + 0.38 * prominence)
            conditions.append({
                "label":       cond["label"],
                "score":       round(min(adj, 0.95), 3),
                "body_system": cond["system"],
            })

    conditions = _apply_modifiers(text, conditions)
    conditions = _maybe_add_covid(text, conditions)

    # De-dupe (modifiers may re-add) and rank
    uniq: Dict[str, Dict[str, Any]] = {}
    for c in conditions:
        if c["label"] not in uniq or c["score"] > uniq[c["label"]]["score"]:
            uniq[c["label"]] = c
    ranked = sorted(uniq.values(), key=lambda x: -x["score"])
    return ranked[:6]


def _get_follow_up_questions(text: str) -> List[Dict[str, Any]]:
    """
    Dynamic, context-aware follow-up questions based on the detected body
    systems. Kept under this name for backward-compatibility with routes/ml.py.
    """
    detected = _detect_categories(text)
    if not detected:
        return [CLARIFY_QUESTION]

    t = text.lower()
    questions: List[Dict[str, Any]] = []
    seen_q: set = set()

    # Pull questions from the top 1-2 detected categories
    for category, _ in detected[:2]:
        for q in CATEGORY_FOLLOWUP_QUESTIONS.get(category, []):
            if q["question"] in seen_q:
                continue
            seen_q.add(q["question"])
            questions.append(q)
            if len(questions) >= 3:
                break
        if len(questions) >= 3:
            break

    # Add a duration question if no timeframe was mentioned and we have room
    has_duration = any(w in t for w in
                       ["day", "days", "week", "weeks", "month", "hour",
                        "since", "yesterday", "today", "morning", "night"])
    if not has_duration and len(questions) < 4:
        questions.append(DURATION_QUESTION)

    return questions[:4]


def _get_self_care(conditions: List[Dict[str, Any]], urgency: str) -> Dict[str, Any]:
    if urgency == "emergency":
        return {
            "immediate": ["Call emergency services (112) immediately", "Do not drive yourself", "Stay calm; lie down if possible"],
            "otc_meds": ["Do not take medication without medical guidance in emergencies"],
            "warning_signs": ["This is already an emergency — get help now."],
        }
    if not conditions:
        return DEFAULT_SELF_CARE
    return SELF_CARE_GUIDANCE.get(conditions[0]["label"], DEFAULT_SELF_CARE)


def _get_food_guidance(conditions: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not conditions:
        return DEFAULT_FOOD_GUIDANCE
    body_system = conditions[0].get("body_system") or CONDITION_BODY_SYSTEM.get(conditions[0]["label"], "")
    return FOOD_GUIDANCE.get(body_system, DEFAULT_FOOD_GUIDANCE)


def _get_specialists(conditions: List[Dict[str, Any]]) -> List[str]:
    specialists: List[str] = []
    seen: set = set()
    for c in conditions[:3]:
        spec = SYSTEM_SPECIALIST.get(c.get("body_system", "General"), "General Physician")
        if spec not in seen:
            seen.add(spec)
            specialists.append(spec)
    return specialists or ["General Physician"]


def _generate_recovery_plan(conditions: List[Dict[str, Any]], urgency: str) -> Dict[str, Any]:
    if not conditions:
        return {}
    if urgency in ("emergency", "high"):
        return {
            "week_1": {
                "goals": ["Get professional medical evaluation", "Follow prescribed treatment", "Rest as needed"],
                "actions": ["Visit a doctor within 24 hours", "Take medications on time", "Monitor symptoms daily", "Keep a symptom diary"],
            },
            "month_1": {
                "goals": ["Complete treatment course", "See symptom improvement", "Doctor follow-up"],
                "actions": ["Follow-up visit in 1-2 weeks", "Continue medications", "Resume light activity gradually", "Maintain a healthy diet"],
            },
            "month_6": {
                "goals": ["Full recovery / stable management", "Healthier lifestyle", "Prevent recurrence"],
                "actions": ["Regular checkups", "Exercise 30 min/day", "Balanced diet", "Manage stress"],
            },
            "year_1": {
                "goals": ["Long-term health maintenance", "Preventive care routine", "Optimal fitness"],
                "actions": ["Annual health checkup", "Sustain diet & exercise", "Recommended screenings", "Mental health check-in"],
            },
        }
    return {
        "week_1": {
            "goals": ["Symptom relief and rest", "Hydration and nutrition", "Watch for worsening"],
            "actions": ["Rest adequately (8h+ sleep)", "Hydrate (8-10 glasses)", "Eat light, nutritious meals", "Track symptoms daily"],
        },
        "month_1": {
            "goals": ["Full resolution of symptoms", "Return to normal activity", "Strengthen immunity"],
            "actions": ["Increase activity gradually", "Immune-boosting foods", "Regular sleep schedule", "See a doctor if symptoms persist"],
        },
        "month_6": {
            "goals": ["Build resilience", "Healthy habits", "Prevent recurrence"],
            "actions": ["Exercise 150 min/week", "Balanced diet", "Annual checkup", "Stress management"],
        },
        "year_1": {
            "goals": ["Optimal health", "Preventive care", "Strong immunity"],
            "actions": ["Maintain healthy BMI", "Preventive screenings", "Consistent exercise", "Seasonal vaccinations"],
        },
    }


def _analysis_confidence(conditions: List[Dict[str, Any]], detected: List[Tuple[str, float]], text: str) -> Dict[str, Any]:
    """A transparency signal the UI uses to encourage refinement when data is thin."""
    word_count = len(re.findall(r"\w+", text))
    top = conditions[0]["score"] if conditions else 0.0
    # More detected signals + more text + a confident top match → higher level
    signal = (top * 0.5) + (min(len(detected), 3) / 3 * 0.3) + (min(word_count, 25) / 25 * 0.2)
    if signal >= 0.6:
        level, msg = "high", "Good signal — add any remaining symptoms to confirm."
    elif signal >= 0.38:
        level, msg = "medium", "Reasonable match. Add more detail to sharpen the result."
    else:
        level, msg = "low", "Limited data. Add more symptoms for a more reliable analysis."
    return {"level": level, "score": round(signal, 3), "message": msg}


# ═══════════════════════════════════════════════════════════════════════════
#  7. MAIN CLASS
# ═══════════════════════════════════════════════════════════════════════════
class SymptomAnalyzer:
    def __init__(self):
        self.pipe = None
        try:
            from transformers import pipeline
            logger.info("Loading NLP model: facebook/bart-large-mnli ...")
            self.pipe = pipeline("zero-shot-classification",
                                 model="facebook/bart-large-mnli", device=-1)
            logger.info("NLP model loaded (used only to re-rank category labels)")
        except Exception as e:
            logger.warning(f"NLP model unavailable ({e}). Category engine runs standalone.")

    def _refine_with_nlp(self, text: str, conditions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Blend category-engine scores with BART zero-shot — but ONLY over the
        medically-relevant labels we already selected. BART can re-rank, never
        introduce unrelated diseases."""
        if not self.pipe or not conditions:
            return conditions
        try:
            labels = [c["label"] for c in conditions]
            res = self.pipe(text, candidate_labels=labels, multi_label=True)
            nlp = dict(zip(res["labels"], res["scores"]))
            for c in conditions:
                blended = 0.6 * c["score"] + 0.4 * float(nlp.get(c["label"], 0.0))
                c["score"] = round(min(blended, 0.96), 3)
            conditions.sort(key=lambda x: -x["score"])
        except Exception as e:
            logger.error(f"NLP re-rank failed: {e}")
        return conditions

    def analyze(self, symptoms: str) -> dict:
        """Full category-driven analysis pipeline."""
        text = symptoms or ""
        urgency  = _detect_urgency(text)
        detected = _detect_categories(text)

        conditions = _classify_by_category(text, detected)
        conditions = self._refine_with_nlp(text, conditions)

        self_care     = _get_self_care(conditions, urgency)
        food_guidance = _get_food_guidance(conditions)
        specialists   = _get_specialists(conditions)
        recovery_plan = _generate_recovery_plan(conditions, urgency)
        follow_up     = _get_follow_up_questions(text)
        body_systems  = list(dict.fromkeys(c.get("body_system", "General") for c in conditions))
        confidence    = _analysis_confidence(conditions, detected, text)

        return {
            "conditions":          conditions,
            "urgency":             urgency,
            "recommendation":      _urgency_recommendation(urgency),
            "body_systems":        body_systems,
            "self_care":           self_care,
            "food_guidance":       food_guidance,
            "specialists":         specialists,
            "recovery_plan":       recovery_plan,
            "follow_up_questions": follow_up,
            "analysis_confidence": confidence,
            "disclaimer": (
                "This is an AI-generated, category-based analysis for informational "
                "purposes only. It does NOT constitute a medical diagnosis. Please "
                "consult a qualified doctor."
            ),
        }
