# backend/services/rag_service.py
"""
Healthcare Knowledge Retrieval Service for SwasthyaSeva AI.

This is the RAG (Retrieval-Augmented Generation) layer.
It implements the same architectural pattern as the reference medical chatbot
(entbappy/Build-a-Complete-Medical-Chatbot-with-LLMs-LangChain-Pinecone-Flask-AWS)
but adapted to:
  • SwasthyaSeva's stack (FastAPI + Anthropic Claude, not Flask + OpenAI/Llama2)
  • Zero external infrastructure (no Pinecone account, no embedding download).

Reference architecture used:
    Documents → chunks → embeddings → Pinecone → top-k retrieval → LLM context

Adapted architecture used here:
    Curated articles → TF-IDF vectorization → cosine similarity → top-k retrieval → Claude context

Why TF-IDF instead of dense embeddings:
  • scikit-learn is already a project dependency (no new packages).
  • The knowledge base is curated and structured — TF-IDF retrieves it accurately.
  • Deterministic, fast (sub-millisecond), and runs entirely in-process.
  • Future migration to Pinecone/Chroma is straightforward — only the
    retrieve() method needs to change; the public interface stays the same.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════════════════
#  PERSONAL-SYMPTOM-QUERY DETECTION
#  Heuristic guard rail. The full redirect logic lives in the system prompt;
#  this is only used by the local fallback when the Claude API is unavailable.
# ════════════════════════════════════════════════════════════════════════════

_PERSONAL_SYMPTOM_TRIGGERS = re.compile(
    r"\b("
    r"i\s+(have|had|got|get|feel|felt|am|'m|am\s+having|'ve\s+been|been\s+having|notice|noticed|developed|suffer|am\s+suffering)"
    r"|my\s+(stomach|head|chest|back|throat|leg|arm|hand|foot|eye|ear|skin|body|heart|neck|knee|joint|muscle|tooth|tongue|lip)"
    r"|i'?m\s+(feeling|experiencing|going\s+through|dealing\s+with|suffering)"
    r"|i\s+keep\s+(having|getting|feeling)"
    r"|why\s+(am\s+i|do\s+i|am\s+i\s+getting|do\s+i\s+keep)"
    r"|what'?s\s+wrong\s+with\s+(me|my)"
    r"|since\s+(yesterday|last\s+night|this\s+morning|today|a\s+week|few\s+days|couple)"
    r")\b",
    re.IGNORECASE,
)

_SELF_SYMPTOM_NOUNS = {
    "headache", "fever", "pain", "ache", "sore", "swollen", "rash", "cough",
    "cold", "nausea", "vomiting", "diarrhea", "diarrhoea", "fatigue", "tired",
    "dizzy", "dizziness", "breathless", "bleeding", "itching", "burning",
    "numbness", "weakness", "palpitation", "palpitations", "chills", "sweating",
    "bloating", "cramps", "constipation", "discharge", "swelling", "bruise",
    "lump", "bump", "shortness", "breath", "insomnia", "anxiety", "depression",
}


def is_personal_symptom_query(text: str) -> bool:
    """
    Returns True if the message looks like a personal symptom description.

    A personal symptom query satisfies BOTH:
      1. Contains a first-person trigger ("I have", "my X hurts", etc.)
      2. Mentions at least one symptom noun.

    Used by the local fallback to avoid running symptom analysis on chat input.
    """
    if not text or len(text.strip()) < 4:
        return False
    text_lower = text.lower()
    has_trigger = bool(_PERSONAL_SYMPTOM_TRIGGERS.search(text_lower))
    has_symptom = any(noun in text_lower for noun in _SELF_SYMPTOM_NOUNS)
    return has_trigger and has_symptom


# ════════════════════════════════════════════════════════════════════════════
#  MEDICAL KNOWLEDGE BASE
#  Curated, evidence-based articles spanning the topic areas the AI must cover.
#  Each article is short enough to fit comfortably in Claude's context.
#  Sources distilled from: WHO, NICE, AHA, ADA, NIH, CDC, Mayo Clinic guidelines.
# ════════════════════════════════════════════════════════════════════════════

MEDICAL_KNOWLEDGE_BASE: list[dict[str, Any]] = [
    {
        "title": "Diabetes Mellitus — Types, Causes & Management",
        "category": "Chronic Disease",
        "keywords": ["diabetes", "type 1", "type 2", "blood sugar", "glucose", "insulin", "HbA1c", "metformin", "diabetic", "hyperglycemia"],
        "content": (
            "Diabetes mellitus is a chronic metabolic disorder of elevated blood glucose due to defective insulin secretion or action.\n\n"
            "TYPES:\n"
            "• Type 1: Autoimmune destruction of pancreatic beta cells; lifelong insulin therapy required.\n"
            "• Type 2 (90%): Insulin resistance + progressive beta-cell failure; linked to obesity, inactivity, genetics.\n"
            "• Gestational: Develops in pregnancy; raises Type 2 risk later.\n\n"
            "DIAGNOSIS: Fasting glucose ≥126 mg/dL, HbA1c ≥6.5%, or 2-hour OGTT ≥200 mg/dL.\n\n"
            "MANAGEMENT:\n"
            "• Lifestyle — low-glycemic diet, portion control, ≥150 min/week moderate exercise, weight loss.\n"
            "• Metformin — first-line oral agent for Type 2; reduces hepatic glucose output.\n"
            "• SGLT2 inhibitors (empagliflozin) — cardiovascular and kidney benefit.\n"
            "• GLP-1 agonists (semaglutide) — significant weight loss + CV benefit.\n"
            "• Insulin — essential in Type 1; used in advanced Type 2.\n\n"
            "TARGETS: HbA1c <7%, fasting glucose 80–130 mg/dL, BP <140/90 mmHg.\n"
            "COMPLICATIONS: Nephropathy, retinopathy, neuropathy, cardiovascular disease, foot ulcers."
        ),
    },
    {
        "title": "Hypertension — High Blood Pressure",
        "category": "Cardiovascular",
        "keywords": ["hypertension", "blood pressure", "systolic", "diastolic", "antihypertensive", "ACE inhibitor", "amlodipine", "losartan", "DASH"],
        "content": (
            "Hypertension is persistent BP ≥130/80 mmHg (AHA 2017). It is the leading modifiable risk factor for stroke, heart attack, and CKD.\n\n"
            "STAGES:\n"
            "• Normal: <120/80 | Elevated: 120–129/<80 | Stage 1: 130–139/80–89 | Stage 2: ≥140/90 | Crisis: >180/120 (emergency).\n\n"
            "CAUSES:\n"
            "• Primary (90–95%) — no identifiable cause; age, salt, alcohol, smoking, obesity, genetics.\n"
            "• Secondary — kidney disease, primary aldosteronism, sleep apnea, thyroid disease, NSAIDs/OCPs.\n\n"
            "MANAGEMENT:\n"
            "Lifestyle (DASH): sodium <2.3 g/day, fruits/vegetables/low-fat dairy, weight loss, aerobic exercise, limit alcohol, quit smoking.\n"
            "Drug classes:\n"
            "• ACE inhibitors (ramipril, lisinopril) — kidney-protective; avoid in pregnancy.\n"
            "• ARBs (losartan, telmisartan) — better tolerated than ACE-I.\n"
            "• Calcium channel blockers (amlodipine) — best for elderly/Black patients.\n"
            "• Thiazide diuretics (HCTZ) — cost-effective; reduce volume.\n"
            "• Beta blockers (metoprolol) — use with concurrent heart failure or post-MI.\n\n"
            "TARGET: <130/80 mmHg most adults; <140/90 elderly >65."
        ),
    },
    {
        "title": "Heart Disease — Coronary Artery Disease & Prevention",
        "category": "Cardiovascular",
        "keywords": ["heart disease", "coronary artery", "angina", "myocardial infarction", "heart attack", "atherosclerosis", "statin", "ECG", "cardiac"],
        "content": (
            "Coronary Artery Disease (CAD) is the leading cause of death globally. Atherosclerotic plaques narrow coronary arteries, reducing myocardial blood flow.\n\n"
            "RISK FACTORS:\n"
            "Modifiable: hypertension, hyperlipidemia, diabetes, smoking, obesity, inactivity, stress.\n"
            "Non-modifiable: age (men >45, women >55), family history, male sex.\n\n"
            "SPECTRUM:\n"
            "• Stable angina — chest pain with exertion; relieved by rest/nitrates.\n"
            "• Unstable angina — new/worsening pain at rest; medical emergency.\n"
            "• NSTEMI — partial coronary occlusion.\n"
            "• STEMI — complete blockage; needs immediate PCI (angioplasty).\n\n"
            "TREATMENT:\n"
            "Medications: aspirin, statins, beta-blockers, ACE inhibitors, nitrates, anticoagulants.\n"
            "Procedures: PCI with stent, CABG (bypass surgery).\n\n"
            "PREVENTION:\n"
            "• LDL <70 mg/dL for high-risk patients.\n"
            "• BP <130/80 mmHg.\n"
            "• Quit smoking — single most effective CV intervention.\n"
            "• Mediterranean diet (olive oil, fish, vegetables).\n"
            "• ≥150 min/week moderate aerobic exercise."
        ),
    },
    {
        "title": "Stroke — Recognition, Types & Prevention",
        "category": "Neurological",
        "keywords": ["stroke", "TIA", "ischemic", "hemorrhagic", "FAST", "brain attack", "blood clot", "thrombus", "cerebrovascular"],
        "content": (
            "Stroke = sudden interruption of brain blood supply causing brain cell death. MEDICAL EMERGENCY.\n\n"
            "RECOGNITION — FAST:\n"
            "• F — Face drooping (one side)\n"
            "• A — Arm weakness (one drifts down)\n"
            "• S — Speech difficulty (slurred or strange)\n"
            "• T — Time: call emergency services IMMEDIATELY (108/112).\n\n"
            "TYPES:\n"
            "• Ischemic (87%) — clot blocks brain artery (thrombotic or embolic from atrial fibrillation).\n"
            "• Hemorrhagic (13%) — bleeding from ruptured aneurysm or hypertensive vessel.\n"
            "• TIA — 'mini-stroke', resolves <24 h; very high stroke risk → urgent evaluation.\n\n"
            "TREATMENT:\n"
            "Ischemic — IV tPA within 4.5 h, or mechanical thrombectomy within 24 h for large-vessel occlusion.\n\n"
            "PREVENTION:\n"
            "• Blood pressure control (most important).\n"
            "• Anticoagulation for atrial fibrillation (warfarin, apixaban).\n"
            "• Antiplatelets (aspirin, clopidogrel) for high-risk patients.\n"
            "• Quit smoking, control diabetes, healthy weight."
        ),
    },
    {
        "title": "Asthma & COPD — Respiratory Conditions",
        "category": "Respiratory",
        "keywords": ["asthma", "COPD", "bronchitis", "emphysema", "inhaler", "bronchodilator", "salbutamol", "spirometry", "wheeze"],
        "content": (
            "ASTHMA: Chronic inflammatory airway disease with reversible bronchoconstriction. Episodes of wheezing, breathlessness, chest tightness, and cough.\n"
            "Triggers: allergens, exercise, cold air, infections, smoke, stress.\n"
            "Diagnosis: spirometry showing reversible airflow obstruction (FEV1 ↑ >12% post-bronchodilator).\n"
            "Treatment:\n"
            "• Reliever (SABA): salbutamol — fast-acting; for acute symptoms.\n"
            "• Controller (ICS): budesonide, fluticasone — daily for persistent asthma.\n"
            "• LABA: formoterol — add-on therapy.\n"
            "• Biologics: omalizumab, mepolizumab — for severe phenotypes.\n\n"
            "COPD: Progressive, not fully reversible airflow obstruction. Main cause: cigarette smoking (80–90%).\n"
            "Types: chronic bronchitis + emphysema.\n"
            "Diagnosis: post-bronchodilator FEV1/FVC <0.70.\n"
            "Treatment: LAMA (tiotropium) + LABA + ICS, pulmonary rehab, supplemental O2 if SpO2 <88%.\n"
            "Smoking cessation is the only intervention proven to slow COPD progression."
        ),
    },
    {
        "title": "Thyroid Disorders — Hypo- & Hyperthyroidism",
        "category": "Endocrine",
        "keywords": ["thyroid", "hypothyroidism", "hyperthyroidism", "TSH", "T3", "T4", "Hashimoto", "Graves", "levothyroxine", "goiter"],
        "content": (
            "The thyroid produces T3 and T4, regulating metabolism, growth, heart rate, and temperature.\n\n"
            "HYPOTHYROIDISM:\n"
            "Causes: Hashimoto's thyroiditis (autoimmune, most common), iodine deficiency, post-thyroidectomy.\n"
            "Features: fatigue, weight gain, cold intolerance, constipation, dry skin, hair loss, depression, bradycardia.\n"
            "Diagnosis: high TSH + low free T4.\n"
            "Treatment: levothyroxine (T4 replacement); take on empty stomach; titrate to normalize TSH.\n\n"
            "HYPERTHYROIDISM:\n"
            "Causes: Graves' disease (most common), toxic multinodular goiter, thyroiditis.\n"
            "Features: weight loss, heat intolerance, tremor, palpitations, anxiety, exophthalmos (Graves').\n"
            "Diagnosis: low TSH + high free T3/T4.\n"
            "Treatment: methimazole (carbimazole), PTU (preferred in pregnancy), radioiodine I-131, thyroidectomy, beta-blockers (propranolol) for symptoms.\n\n"
            "SCREENING: TSH every 5 years for adults; more often in women >50."
        ),
    },
    {
        "title": "Antibiotics — Uses, Classes & Resistance",
        "category": "Medications",
        "keywords": ["antibiotic", "amoxicillin", "azithromycin", "ciprofloxacin", "penicillin", "resistance", "AMR", "bacterial infection"],
        "content": (
            "Antibiotics kill or inhibit bacterial growth. They do NOT work against viruses (cold, flu, COVID-19).\n\n"
            "MAJOR CLASSES:\n"
            "• Penicillins (amoxicillin, ampicillin) — common infections; allergy possible.\n"
            "• Cephalosporins (cephalexin, ceftriaxone) — broad spectrum.\n"
            "• Macrolides (azithromycin, clarithromycin) — respiratory, atypicals.\n"
            "• Fluoroquinolones (ciprofloxacin, levofloxacin) — UTI, respiratory; rising resistance.\n"
            "• Tetracyclines (doxycycline) — atypicals, acne, malaria prophylaxis.\n"
            "• Aminoglycosides (gentamicin) — hospital, severe gram-negatives.\n"
            "• Metronidazole — anaerobes and protozoa (C. difficile, giardia).\n"
            "• Co-trimoxazole — UTI, Pneumocystis pneumonia.\n\n"
            "RESISTANCE (AMR):\n"
            "Major global health threat (>1.3 million deaths/year). Mechanisms: beta-lactamases, efflux pumps, altered targets.\n"
            "Prevention: complete the full course; never share antibiotics; do not demand them for viral illness.\n\n"
            "Always complete the prescribed course even if you feel better — stopping early causes treatment failure and resistance."
        ),
    },
    {
        "title": "Pain Management — Analgesics & Their Safe Use",
        "category": "Medications",
        "keywords": ["pain", "analgesic", "paracetamol", "ibuprofen", "NSAID", "opioid", "tramadol", "acetaminophen", "aspirin"],
        "content": (
            "Pain management follows the WHO analgesic ladder.\n\n"
            "STEP 1 — MILD PAIN (non-opioid):\n"
            "• Paracetamol (acetaminophen) — first-line; max 4 g/day; hepatotoxic in overdose or with alcohol.\n"
            "• NSAIDs (ibuprofen, naproxen, diclofenac) — anti-inflammatory; risks: GI bleeding, kidney injury, CV events; take with food.\n"
            "• Aspirin — analgesic + antiplatelet; avoid in children (Reye's), avoid with active GI ulcers.\n"
            "• Topical: diclofenac gel, lidocaine patch — fewer systemic effects.\n\n"
            "STEP 2 — MODERATE (weak opioid + non-opioid):\n"
            "• Codeine + paracetamol — opioid prodrug; constipation common.\n"
            "• Tramadol — opioid + SNRI; risk of seizures; avoid with SSRIs.\n\n"
            "STEP 3 — SEVERE (strong opioid):\n"
            "• Morphine, oxycodone, fentanyl — severe acute or cancer pain; risk of dependence and respiratory depression.\n\n"
            "SPECIFIC PAIN TYPES:\n"
            "• Neuropathic — gabapentin, pregabalin, duloxetine, amitriptyline (not standard analgesics).\n"
            "• Migraine — triptans + NSAIDs; avoid opioids.\n"
            "• Musculoskeletal — NSAIDs + physiotherapy + heat/cold.\n\n"
            "SAFE USE: don't combine multiple NSAIDs, don't exceed dose, use NSAIDs with caution in CV/renal disease."
        ),
    },
    {
        "title": "Cholesterol & Statins — Lipid Management",
        "category": "Medications",
        "keywords": ["cholesterol", "statin", "LDL", "HDL", "triglycerides", "atorvastatin", "rosuvastatin", "hyperlipidemia", "lipid profile"],
        "content": (
            "Cholesterol is essential but elevated levels increase cardiovascular risk.\n\n"
            "LIPID PROFILE (mg/dL):\n"
            "• Total cholesterol — desirable <200, borderline 200–239, high ≥240.\n"
            "• LDL ('bad') — <100 optimal; <70 for high-risk patients.\n"
            "• HDL ('good') — >40 (men), >50 (women); higher is better.\n"
            "• Triglycerides — <150 normal; ≥500 raises pancreatitis risk.\n\n"
            "STATINS (HMG-CoA reductase inhibitors):\n"
            "Common: atorvastatin (Lipitor), rosuvastatin (Crestor), simvastatin, pravastatin.\n"
            "Benefits: ↓LDL 30–50%, proven CV mortality reduction in high-risk patients.\n"
            "Side effects: myalgia (most common), elevated liver enzymes (rare), small new-onset diabetes risk.\n\n"
            "OTHERS:\n"
            "• Ezetimibe — reduces intestinal cholesterol absorption; combined with statin.\n"
            "• Fibrates (fenofibrate) — primarily lower triglycerides.\n"
            "• PCSK9 inhibitors (evolocumab) — injectable; powerful LDL reduction.\n"
            "• Omega-3 — reduce triglycerides.\n\n"
            "LIFESTYLE: Mediterranean diet, omega-3 fish, oats (beta-glucan), reduce saturated/trans fats, exercise, quit smoking."
        ),
    },
    {
        "title": "Nutrition & Dietary Guidelines",
        "category": "Nutrition",
        "keywords": ["nutrition", "diet", "carbohydrates", "protein", "fat", "vitamins", "fiber", "calories", "Mediterranean", "DASH"],
        "content": (
            "Good nutrition is the foundation of health. Major guidelines recommend a balanced, whole-foods approach.\n\n"
            "MACRONUTRIENTS:\n"
            "• Carbohydrates (45–65% kcal) — prefer complex carbs (whole grains, legumes, vegetables, fruits); limit refined sugars.\n"
            "• Protein (10–35% kcal) — lean meats, fish, eggs, legumes, tofu, nuts; minimum 0.8 g/kg body weight.\n"
            "• Fats (20–35% kcal) — unsaturated (olive oil, avocado, nuts) preferred; saturated <10%; avoid trans fats entirely.\n\n"
            "KEY MICRONUTRIENTS:\n"
            "• Vitamin D — 600–800 IU/day; sun + fatty fish + fortified foods.\n"
            "• Calcium — 1000–1200 mg/day; dairy, leafy greens.\n"
            "• Iron — 8–18 mg/day; red meat, legumes; pair with vitamin C.\n"
            "• B12 — animal products only; supplement if vegan.\n"
            "• Folate — 400–800 mcg/day in pregnancy; leafy greens.\n"
            "• Omega-3 — fatty fish 2×/week.\n\n"
            "EVIDENCE-BASED PATTERNS:\n"
            "• Mediterranean diet — reduces CV risk by 25–30%.\n"
            "• DASH diet — proven to lower blood pressure.\n"
            "• Avoid ultra-processed foods (linked to obesity, T2DM, cancer, CVD).\n\n"
            "Hydration: 2–2.5 L water/day. Fiber: 25–38 g/day. Free sugars: <25 g/day."
        ),
    },
    {
        "title": "First Aid — Burns, Wounds & Sprains",
        "category": "First Aid",
        "keywords": ["first aid", "burn", "wound", "cut", "bleeding", "bandage", "PRICE", "RICE", "sprain", "fracture", "emergency"],
        "content": (
            "BURNS:\n"
            "Classification: superficial (1°) — redness; partial-thickness (2°) — blisters; full-thickness (3°) — charred, painless.\n"
            "First aid (minor):\n"
            "1. Cool with cool (not cold) running water for 10–20 min.\n"
            "2. Remove jewellery near the burn.\n"
            "3. Cover with clean non-stick dressing.\n"
            "4. DO NOT burst blisters; DO NOT apply butter, toothpaste, or ice.\n"
            "5. Seek care for burns >1% body surface, on face/hands/genitals, or deep burns.\n\n"
            "BLEEDING WOUNDS:\n"
            "1. Apply firm direct pressure with clean cloth for 10–15 min — don't lift to peek.\n"
            "2. Elevate the limb above heart level.\n"
            "3. DO NOT remove deeply embedded objects.\n"
            "4. Tourniquet only as last resort for life-threatening arterial bleeding.\n"
            "5. Deep wounds, animal bites, infected wounds → medical care + tetanus check.\n\n"
            "SPRAINS & STRAINS — PRICE:\n"
            "• P — Protect from further injury\n"
            "• R — Rest\n"
            "• I — Ice (20 min on, 20 off) for first 48 h\n"
            "• C — Compression with elastic bandage\n"
            "• E — Elevate above heart level\n\n"
            "FRACTURES: do not realign; immobilize in position found; ice; emergency care. Open fracture = major emergency.\n\n"
            "CHOKING (conscious adult): 5 back blows between shoulder blades, then 5 abdominal thrusts (Heimlich). Repeat until cleared or unconscious (then start CPR + call emergency)."
        ),
    },
    {
        "title": "CPR & Emergency Cardiac Response",
        "category": "First Aid",
        "keywords": ["CPR", "cardiac arrest", "resuscitation", "AED", "defibrillator", "chest compression", "BLS"],
        "content": (
            "Cardiac arrest = sudden cessation of effective heart pumping. Immediate CPR can double or triple survival.\n\n"
            "CHAIN OF SURVIVAL:\n"
            "1. Recognize and call emergency services (108/112/911).\n"
            "2. Early CPR — emphasis on chest compressions.\n"
            "3. Rapid defibrillation (AED).\n"
            "4. Advanced life support.\n"
            "5. Post-arrest care.\n\n"
            "ADULT CPR:\n"
            "1. Check responsiveness — tap shoulders, shout.\n"
            "2. Call emergency services (or ask bystander).\n"
            "3. Check breathing for 10 seconds.\n"
            "4. If not breathing → 30 chest compressions:\n"
            "   • Heel of hand on centre of chest (lower half of sternum).\n"
            "   • Compress 5–6 cm deep.\n"
            "   • Rate: 100–120/min.\n"
            "   • Allow full chest recoil.\n"
            "5. If trained: 2 rescue breaths after every 30 compressions.\n"
            "6. Continue until AED arrives, person breathes, or you're exhausted.\n\n"
            "AED: turn on, follow voice prompts, apply pads as shown, no one touches the patient during shock, resume CPR immediately after.\n\n"
            "RECOVERY POSITION: if breathing but unconscious, turn on side to protect airway.\n\n"
            "CHILD CPR: 2 fingers (infant) or 1 hand (child); same 30:2 ratio; gentler depth.\n\n"
            "Starting CPR is always better than hesitating. Good Samaritan laws protect rescuers."
        ),
    },
    {
        "title": "Mental Health — Depression, Anxiety & Stress",
        "category": "Mental Health",
        "keywords": ["depression", "anxiety", "mental health", "stress", "CBT", "antidepressant", "SSRI", "therapy", "panic"],
        "content": (
            "Mental health conditions are common and treatable. About 1 in 4 people experience one each year.\n\n"
            "DEPRESSION:\n"
            "Persistent low mood, anhedonia, fatigue, sleep/appetite changes, poor concentration, worthlessness, suicidal thoughts in severe cases.\n"
            "Diagnosis: ≥5 symptoms for ≥2 weeks (PHQ-9 screening).\n"
            "Treatment:\n"
            "• Mild — lifestyle (exercise, sleep, social support) + psychotherapy (CBT, IPT).\n"
            "• Moderate-Severe — SSRIs (fluoxetine, sertraline, escitalopram) + therapy. Allow 4–6 weeks for full effect.\n"
            "• Treatment-resistant — SNRIs, mirtazapine, ECT.\n\n"
            "ANXIETY DISORDERS: GAD, social anxiety, panic disorder, PTSD, OCD.\n"
            "Treatment: CBT (most evidence-based), exposure therapy, SSRIs/SNRIs; benzodiazepines short-term only (dependence risk).\n\n"
            "STRESS MANAGEMENT:\n"
            "• Mindfulness — proven to reduce cortisol.\n"
            "• Exercise — 30 min/day cuts depression risk by 30%.\n"
            "• Sleep hygiene — 7–9 h, consistent schedule.\n"
            "• Social connection — isolation worsens mental health.\n"
            "• Journaling — helps process emotions.\n\n"
            "CRISIS: If experiencing suicidal thoughts, contact a mental-health helpline immediately (India: iCall 9152987821, Vandrevala 1860-2662-345)."
        ),
    },
    {
        "title": "Vaccines & Immunization Schedule",
        "category": "Preventive Health",
        "keywords": ["vaccine", "vaccination", "immunization", "flu shot", "COVID", "hepatitis B", "MMR", "tetanus", "schedule"],
        "content": (
            "Vaccines are among the most effective public-health interventions, preventing millions of deaths annually. They expose the immune system to a harmless antigen so memory cells form for future protection.\n\n"
            "ADULT IMMUNIZATION (India/general):\n"
            "• Influenza — annual; especially elderly, healthcare workers, chronic-disease patients.\n"
            "• Hepatitis B — 3-dose series if not vaccinated; check anti-HBs.\n"
            "• Hepatitis A — 2-dose series; travelers, high-risk individuals.\n"
            "• Tetanus/Diphtheria (Td/Tdap) — booster every 10 years; Tdap once for whooping-cough protection.\n"
            "• Pneumococcal — adults 65+ and high-risk younger adults.\n"
            "• HPV — recommended up to age 26; prevents cervical and other cancers.\n"
            "• COVID-19 — primary series + boosters per national guidelines.\n"
            "• Typhoid — every 3 years for high-risk/travelers.\n\n"
            "CHILDHOOD (India NIP): BCG, OPV, HepB at birth; DPT, Hib, IPV, PCV, Rotavirus 6–14 weeks; MMR 9 months; JE and DPT booster 16–24 months.\n\n"
            "SAFETY: modern vaccines undergo extensive testing. Side effects are usually mild (sore arm, low-grade fever); serious reactions are extremely rare. Benefits far outweigh risks.\n\n"
            "Avoid live vaccines (MMR, varicella, oral typhoid) in severely immunocompromised individuals — consult physician."
        ),
    },
    {
        "title": "Preventive Health Screenings — When & What",
        "category": "Preventive Health",
        "keywords": ["screening", "health check", "cancer screening", "mammogram", "colonoscopy", "Pap smear", "preventive care"],
        "content": (
            "Preventive screenings detect disease early when it is most treatable.\n\n"
            "CANCER:\n"
            "• Breast — mammogram every 1–2 years from age 40–50.\n"
            "• Cervical — Pap smear every 3 years (21–65), or Pap+HPV co-test every 5 years (30–65).\n"
            "• Colorectal — colonoscopy every 10 years from age 45 (earlier with family history); annual FIT test as alternative.\n"
            "• Prostate (PSA) — shared decision from age 50 (45 if high-risk).\n"
            "• Lung — annual low-dose CT for heavy smokers age 50–80.\n\n"
            "CARDIOVASCULAR / METABOLIC:\n"
            "• Blood pressure — every 1–2 years; annually if 130–139/80–89.\n"
            "• Lipid profile — every 4–6 years; more often with risk factors.\n"
            "• HbA1c / fasting glucose — every 3 years from age 35 (earlier if overweight).\n"
            "• BMI / waist circumference — every visit.\n\n"
            "OTHER:\n"
            "• Thyroid (TSH) — every 5 years for women >50.\n"
            "• Vision — every 1–2 years from 40; annually >65.\n"
            "• Dental — every 6 months.\n"
            "• Bone density (DEXA) — women ≥65 or postmenopausal with risk factors.\n"
            "• HIV — at least once aged 15–65.\n\n"
            "ANNUAL HEALTH CHECK panel: CBC, fasting glucose, HbA1c, lipid profile, LFT, KFT/BMP, TSH, Vitamin D, B12."
        ),
    },
    {
        "title": "Sleep Health — Disorders & Improvement",
        "category": "Wellness",
        "keywords": ["sleep", "insomnia", "sleep apnea", "melatonin", "sleep hygiene", "circadian", "snoring"],
        "content": (
            "Adults need 7–9 hours of quality sleep per night. Sleep is critical for cognition, immunity, metabolism, and mental wellbeing.\n\n"
            "COMMON DISORDERS:\n"
            "• Insomnia — affects 10–30% of adults; primary or secondary (pain, depression, anxiety, medications).\n"
            "• Obstructive sleep apnea — airway collapse during sleep; snoring, gasping, daytime sleepiness; linked to hypertension, AF, diabetes; diagnosed by polysomnography; treated with CPAP.\n"
            "• Restless legs syndrome — irresistible urge to move legs; treated with dopamine agonists, iron.\n"
            "• Narcolepsy — daytime sleepiness + cataplexy; treated with modafinil.\n\n"
            "SLEEP HYGIENE:\n"
            "• Consistent sleep–wake schedule (even weekends).\n"
            "• Bedroom for sleep/sex only — no screens or work.\n"
            "• Cool (18–20 °C), dark, quiet environment.\n"
            "• No caffeine after 2 PM; alcohol disrupts sleep architecture.\n"
            "• No screens 1 h before bed.\n"
            "• Daytime exercise (not within 2–3 h of bedtime).\n"
            "• Wind-down routine: reading, bath, meditation.\n"
            "• Don't stay in bed awake >20 min — get up until sleepy.\n\n"
            "MELATONIN: useful for jet lag and shift work (0.5–5 mg, 30–60 min before bed); modest evidence for primary insomnia.\n"
            "CBT-I: gold-standard treatment for insomnia; outperforms medications long-term."
        ),
    },
    {
        "title": "Digestive Health — GERD, IBS & Common GI Conditions",
        "category": "Gastroenterology",
        "keywords": ["digestive", "GERD", "acid reflux", "heartburn", "IBS", "constipation", "diarrhea", "ulcer", "PPI"],
        "content": (
            "GERD: stomach acid flows back into esophagus. Symptoms: heartburn, regurgitation, chronic cough, hoarseness.\n"
            "Lifestyle: avoid trigger foods (spicy, fatty, citrus, caffeine, alcohol, chocolate), small meals, no lying down for 3 h post-meal, elevate head of bed, weight loss.\n"
            "Medications: antacids (immediate), H2 blockers (famotidine), PPIs (omeprazole, pantoprazole — most effective; 30–60 min pre-meal).\n"
            "Complications: esophagitis, Barrett's esophagus, stricture.\n\n"
            "IBS: functional disorder — abdominal pain + altered bowel habit (D/C/mixed) without structural cause.\n"
            "Management: low-FODMAP diet, soluble fiber (psyllium), antispasmodics (mebeverine), antidiarrheals (loperamide), laxatives, gut-directed CBT/hypnotherapy.\n\n"
            "CONSTIPATION: <3 BMs/week, straining, hard stools.\n"
            "Causes: low fibre/fluid, inactivity, opioids/iron, hypothyroidism.\n"
            "Management: ↑fiber (25–38 g/day), water (2 L+/day), exercise; bulk-forming → osmotic (macrogol) → stimulant (bisacodyl, senna) laxatives.\n\n"
            "PEPTIC ULCER: H. pylori (#1) or NSAIDs. Test and treat H. pylori (triple therapy: PPI + amoxicillin + clarithromycin).\n\n"
            "RED FLAGS (urgent investigation): blood in stool, unexplained weight loss, dysphagia, iron-deficiency anemia, family history of colorectal cancer, new symptoms >50."
        ),
    },
    {
        "title": "Women's Health — PCOS, Menopause & Reproductive Health",
        "category": "Women's Health",
        "keywords": ["PCOS", "menopause", "period", "menstruation", "pregnancy", "fertility", "estrogen", "endometriosis", "HRT"],
        "content": (
            "PCOS: most common endocrine disorder in women of reproductive age (5–15%). Irregular periods + hyperandrogenism (acne, hirsutism, hair loss) + polycystic ovaries on ultrasound. Linked to insulin resistance, T2DM, obesity, infertility.\n"
            "Management: 5–10% weight loss markedly improves symptoms; combined OCP regulates cycles + treats acne/hirsutism; metformin for insulin resistance; clomiphene/letrozole for fertility.\n\n"
            "MENSTRUAL HEALTH: normal cycle 24–38 days; bleeding 2–7 days; loss 20–80 mL.\n"
            "Abnormal: amenorrhea (absent), oligomenorrhea (infrequent), menorrhagia (heavy), dysmenorrhea (painful).\n"
            "Dysmenorrhea: NSAIDs (ibuprofen, mefenamic acid) from day 1; OCP reduces severity.\n\n"
            "MENOPAUSE: ≥12 months without menstruation; average 51 years.\n"
            "Symptoms: hot flashes, night sweats, vaginal dryness, mood, sleep, bone loss.\n"
            "Management: HRT most effective for symptoms; SSRIs/SNRIs as non-hormonal option; vaginal estrogen for genitourinary syndrome; lifestyle.\n"
            "Bone health: calcium + vitamin D, weight-bearing exercise, DEXA scan at menopause.\n\n"
            "PREGNANCY CARE: folic acid 400 mcg pre-conception + first trimester; antenatal checks; avoid alcohol/smoking; iron + calcium as needed.\n\n"
            "ENDOMETRIOSIS: endometrial tissue outside uterus; painful periods, pelvic pain, infertility. NSAIDs, hormonal therapy, surgery."
        ),
    },
    {
        "title": "Kidney Health & Chronic Kidney Disease",
        "category": "Nephrology",
        "keywords": ["kidney", "renal", "CKD", "creatinine", "eGFR", "dialysis", "nephropathy", "proteinuria", "kidney disease"],
        "content": (
            "Kidneys filter ~180 L of blood daily, removing waste and regulating fluid, electrolytes, and BP.\n\n"
            "CHRONIC KIDNEY DISEASE (CKD):\n"
            "Progressive loss of kidney function. Top causes: diabetic nephropathy (#1), hypertension, glomerulonephritis, polycystic kidney disease.\n"
            "Diagnosis: eGFR <60 mL/min/1.73m² for ≥3 months OR markers of damage (proteinuria, hematuria) ≥3 months.\n"
            "Staging: G1–G5 by eGFR; A1–A3 by urine albumin/creatinine ratio.\n"
            "Symptoms (often absent until late): fatigue, ankle swelling, hypertension, nocturia, low urine output, nausea, anemia.\n"
            "Stage 5 (eGFR <15) = kidney failure → dialysis or transplant.\n\n"
            "MANAGEMENT:\n"
            "• Treat the cause: tight glucose control, BP <130/80 (ACE-I/ARBs preferred — they also reduce proteinuria).\n"
            "• Avoid nephrotoxins: NSAIDs, contrast dyes, aminoglycosides, herbal remedies.\n"
            "• Diet: lower-protein may slow progression; restrict K/PO4 in late CKD.\n"
            "• Anemia: erythropoietin-stimulating agents + iron.\n"
            "• Bone disease: calcium, vitamin D, phosphate binders.\n"
            "• Nephrology referral at eGFR <30.\n\n"
            "ACUTE KIDNEY INJURY (AKI): sudden drop. Causes: dehydration, sepsis, drugs, obstruction. Medical emergency."
        ),
    },
    {
        "title": "Liver Disease — Hepatitis, Fatty Liver & Cirrhosis",
        "category": "Gastroenterology",
        "keywords": ["liver", "hepatitis", "fatty liver", "NAFLD", "cirrhosis", "jaundice", "ALT", "AST", "alcohol liver"],
        "content": (
            "The liver performs 500+ functions including detoxification, protein synthesis, bile production, and metabolism.\n\n"
            "HEPATITIS:\n"
            "• Hep A — fecal-oral; self-limiting; vaccine-preventable.\n"
            "• Hep B — blood/sexual/vertical; can become chronic; vaccine-preventable; antivirals (tenofovir, entecavir) for chronic disease.\n"
            "• Hep C — blood-borne; 75–85% chronic; now curable with DAAs (sofosbuvir + velpatasvir/ledipasvir, 8–12 weeks, >95% cure).\n"
            "• Hep D — only with Hep B; HBV vaccine prevents it.\n"
            "• Hep E — fecal-oral; usually self-limiting; dangerous in pregnancy.\n\n"
            "NAFLD/MASLD: most common liver condition globally; linked to obesity and metabolic syndrome.\n"
            "Spectrum: simple steatosis → NASH → fibrosis → cirrhosis.\n"
            "Management: weight loss (>5% reduces liver fat; >10% improves inflammation); treat metabolic conditions.\n\n"
            "ALCOHOLIC LIVER DISEASE: fatty liver → alcoholic hepatitis → cirrhosis. Abstinence is the cornerstone.\n\n"
            "CIRRHOSIS: irreversible scarring; complications include portal hypertension, varices, ascites, encephalopathy, hepatocellular carcinoma. Liver transplant for end-stage.\n\n"
            "WARNING SIGNS: jaundice (yellow skin/eyes), dark urine, pale stools, RUQ pain, abdominal distension → urgent care."
        ),
    },
    {
        "title": "Exercise & Physical Activity Guidelines",
        "category": "Wellness",
        "keywords": ["exercise", "physical activity", "fitness", "cardio", "strength training", "aerobic", "workout", "sedentary"],
        "content": (
            "Physical activity is among the most powerful interventions for preventing and treating chronic disease.\n\n"
            "WHO GUIDELINES (adults 18–64):\n"
            "• Moderate aerobic — 150–300 min/week (brisk walking, cycling, swimming).\n"
            "• Vigorous aerobic — 75–150 min/week (running, HIIT).\n"
            "• Muscle strengthening — ≥2 days/week (all major muscle groups).\n"
            "• Reduce sedentary time — break up sitting every 30–60 min.\n\n"
            "BENEFITS:\n"
            "• Cardiovascular — ↓heart-disease risk 30–40%, lowers BP.\n"
            "• Diabetes — ↓T2DM risk 35–40%; improves insulin sensitivity.\n"
            "• Cancer — ↓colon cancer 30–40%, breast cancer 20–30%.\n"
            "• Mental health — as effective as antidepressants for mild–moderate depression.\n"
            "• Bone — weight-bearing exercise prevents osteoporosis.\n"
            "• Longevity — even 15 min/day reduces all-cause mortality 14%.\n\n"
            "TYPES:\n"
            "• Aerobic — improves VO2 max.\n"
            "• Resistance — builds muscle, raises metabolic rate, improves bone density.\n"
            "• Flexibility — yoga, stretching.\n"
            "• Balance — tai chi reduces falls in elderly.\n\n"
            "GETTING STARTED SAFELY: start low, go slow; consult a doctor before vigorous exercise with heart disease, severe hypertension, or uncontrolled diabetes; warm up + cool down; pain (not discomfort) → stop."
        ),
    },
    {
        "title": "Vitamins & Supplements — Evidence Review",
        "category": "Nutrition",
        "keywords": ["vitamins", "supplements", "vitamin D", "B12", "iron", "zinc", "magnesium", "omega-3", "multivitamin", "deficiency"],
        "content": (
            "Most people on a balanced diet don't need supplements. Specific deficiencies are common, and supplementation is evidence-based for certain populations.\n\n"
            "VITAMIN D: very common deficiency globally; affects bone health, immunity, mood.\n"
            "Supplementation: 1000–2000 IU/day for most adults; up to 4000 IU for deficient; 60,000 IU weekly therapeutic dose under medical supervision.\n"
            "Test: 25-OH vitamin D — <20 ng/mL deficient, 30–100 ng/mL sufficient.\n\n"
            "VITAMIN B12: vegetarians/vegans, elderly, metformin users.\n"
            "Symptoms: megaloblastic anemia, peripheral neuropathy, cognitive decline.\n"
            "Supplementation: 500–1000 mcg/day oral (effective as injections in most), or monthly IM.\n\n"
            "IRON: most common nutritional deficiency, especially women of reproductive age.\n"
            "Supplementation: ferrous sulfate 200 mg 2–3×/day with vitamin C between meals; common SE: constipation, dark stools.\n\n"
            "OMEGA-3: reduces triglycerides, supports brain health. 1–4 g/day fish oil; prescription icosapentaenoic acid for hypertriglyceridemia.\n\n"
            "FOLIC ACID: 400–800 mcg/day for women planning pregnancy — prevents neural tube defects.\n\n"
            "NOT RECOMMENDED: routine multivitamins for healthy well-nourished adults show no consistent mortality benefit. High-dose antioxidant supplements (A, C, E) may increase mortality in some studies."
        ),
    },
    {
        "title": "Skin Conditions — Eczema, Psoriasis, Acne",
        "category": "Dermatology",
        "keywords": ["skin", "eczema", "psoriasis", "acne", "dermatitis", "rash", "moisturizer", "topical steroid", "sunscreen"],
        "content": (
            "ECZEMA (atopic dermatitis): chronic itchy, dry, inflamed skin. Part of the atopic triad with asthma and allergic rhinitis.\n"
            "Triggers: irritants (soap, detergent), allergens (dust mites, pet dander), stress, heat, dry weather.\n"
            "Management:\n"
            "• Moisturize frequently (emollients) — cornerstone; apply within 3 min of bathing.\n"
            "• Topical corticosteroids for flares (mild for face/groin; moderate-potent for body).\n"
            "• Topical calcineurin inhibitors (tacrolimus, pimecrolimus) for sensitive areas.\n"
            "• Sedating antihistamines for itch/sleep.\n"
            "• Biologics (dupilumab) for severe disease.\n\n"
            "PSORIASIS: chronic autoimmune; thick scaly red plaques; affects 2–3% of population.\n"
            "Treatment: topical (corticosteroids, vitamin D analogues, tar), phototherapy (UVB), systemic (methotrexate, cyclosporine), biologics (TNF/IL-17/IL-23 inhibitors) for moderate–severe.\n"
            "Associated: psoriatic arthritis, CV risk, depression.\n\n"
            "ACNE: most common skin condition; follicles plug with oil + dead skin.\n"
            "Treatment:\n"
            "• Mild — topical retinoids (adapalene), benzoyl peroxide, salicylic acid.\n"
            "• Moderate — topical + oral antibiotics (doxycycline); limit antibiotic duration.\n"
            "• Severe nodular — isotretinoin; teratogenic (strict contraception required).\n\n"
            "SUNSCREEN: SPF 30+ broad-spectrum; ½ tsp for face+neck; reapply every 2 h. Reduces skin cancer and photoaging.\n\n"
            "TINEA (fungal): topical antifungals (clotrimazole, terbinafine); oral terbinafine for nail fungus."
        ),
    },
    {
        "title": "Respiratory Infections — Pneumonia, Bronchitis, Flu, COVID",
        "category": "Respiratory",
        "keywords": ["pneumonia", "bronchitis", "influenza", "flu", "respiratory infection", "cough", "cold", "COVID"],
        "content": (
            "INFLUENZA: viral; sudden fever, myalgia, headache, fatigue, dry cough, sore throat (more severe and abrupt than the common cold).\n"
            "Treatment: usually self-limiting (7–10 days); antivirals (oseltamivir/Tamiflu within 48 h) for high-risk; rest, fluids, paracetamol.\n"
            "Prevention: annual flu vaccine.\n\n"
            "PNEUMONIA: lung infection — bacterial (Strep pneumoniae, H. influenzae), viral, atypical (Mycoplasma, Legionella).\n"
            "Symptoms: productive cough, fever, pleuritic chest pain, dyspnea; CXR shows consolidation.\n"
            "Severity: CURB-65 score guides outpatient vs hospital.\n"
            "Treatment: community-acquired — amoxicillin ± macrolide; hospital — IV beta-lactam + macrolide; ICU — broad-spectrum.\n"
            "Pneumococcal vaccine reduces risk in elderly and high-risk.\n\n"
            "ACUTE BRONCHITIS: usually viral; productive cough 2–3 weeks. Antibiotics NOT routinely indicated (95% viral). Honey + lemon, hydration.\n\n"
            "COVID-19: SARS-CoV-2; variable severity.\n"
            "Prevention: vaccination, masks, ventilation, hand hygiene.\n"
            "Treatment: most mild — symptomatic; nirmatrelvir/ritonavir or molnupiravir for high-risk within 5 days; dexamethasone for severe/hospitalized requiring O2.\n\n"
            "COMMON COLD: viral (rhinovirus 40%); self-limiting 7–10 days. Antibiotics ineffective. Symptomatic care: decongestants, antihistamines, analgesics, saline nasal rinse, zinc lozenges (modest benefit if taken early)."
        ),
    },
    {
        "title": "Medical Emergency Warning Signs",
        "category": "Emergency",
        "keywords": ["emergency", "heart attack", "stroke", "anaphylaxis", "sepsis", "emergency signs", "red flags", "urgent"],
        "content": (
            "These signs require IMMEDIATE emergency medical attention. Call 108/112/911 immediately.\n\n"
            "🚨 HEART ATTACK: chest pain/pressure (may radiate to jaw, left arm, back), shortness of breath, sweating, nausea, lightheadedness.\n"
            "Action: call emergency; chew 300 mg aspirin if not allergic; do not drive yourself; unlock the door for paramedics.\n\n"
            "🚨 STROKE — FAST: face drooping, arm weakness, speech difficulty, time to call. Plus sudden severe headache, vision loss, confusion, balance loss.\n"
            "Action: note time of onset — crucial for treatment window (tPA <4.5 h).\n\n"
            "🚨 ANAPHYLAXIS: throat swelling, difficulty breathing/swallowing, severe widespread hives, sudden BP drop, loss of consciousness after allergen exposure.\n"
            "Action: epinephrine auto-injector (EpiPen) IM into thigh IMMEDIATELY → call emergency → lay flat, raise legs → second EpiPen if no improvement in 5–15 min.\n\n"
            "🚨 SEPSIS: suspected infection + ≥2 of (T >38 °C or <36 °C, HR >90, RR >20, altered mental status). Early antibiotics within 1 hour dramatically improve survival.\n\n"
            "🚨 SEVERE ASTHMA ATTACK: unable to complete sentences, cyanosis (blue lips), SpO2 <92%, peak flow <33% predicted, silent chest.\n\n"
            "DIABETIC EMERGENCY:\n"
            "• Hypoglycemia (BG <70) — shaking, confusion, sweating → 15 g fast glucose (4 tablets, 150 mL juice) → recheck in 15 min.\n"
            "• Hyperglycemic emergencies (DKA, HHS) → hospital emergency.\n\n"
            "🚨 PULMONARY EMBOLISM: sudden pleuritic chest pain, dyspnea, leg swelling/DVT, tachycardia, hemoptysis. Immediate CT angiography.\n\n"
            "🚨 MENINGITIS: severe headache + photophobia + neck stiffness + non-blanching rash → immediate emergency."
        ),
    },
    {
        "title": "Children's Health & Pediatric Care",
        "category": "Pediatrics",
        "keywords": ["children", "pediatric", "child health", "baby", "infant", "fever in child", "growth", "development", "vaccination child"],
        "content": (
            "NEWBORN CARE:\n"
            "• Breastfeeding — exclusively for 6 months; continue with complementary food up to 2 years (WHO).\n"
            "• Vitamin D — 400 IU/day for breastfed infants from birth.\n"
            "• Safe sleep — back to sleep, firm mattress, no pillows/soft bedding (reduces SIDS).\n"
            "• Jaundice — common first week; phototherapy if bilirubin high; concerning if yellow extends below knees.\n\n"
            "FEVER IN CHILDREN:\n"
            "• Temperature >38 °C (rectal/ear) = fever.\n"
            "• Under 3 months — ANY fever → immediate medical attention.\n"
            "• 3–36 months — fever >39 °C or persistent >48 h → see doctor.\n"
            "• Treatment — paracetamol (NOT aspirin); dress lightly; ensure fluids.\n"
            "• Febrile seizures — common (2–5%); usually brief; rarely dangerous; treat the fever.\n\n"
            "DEVELOPMENTAL MILESTONES:\n"
            "• 2 mo — social smile, coos.\n"
            "• 4 mo — babbles, head control.\n"
            "• 9 mo — sits, stranger anxiety.\n"
            "• 12 mo — first words, cruises along furniture.\n"
            "• 18 mo — 10–20 words, walks well.\n"
            "• 2 y — 2-word sentences, runs.\n"
            "• 3 y — sentences, toilet training.\n"
            "RED FLAGS: no smile at 2 mo, no words at 12 mo, regression — needs developmental evaluation.\n\n"
            "COMMON ILLNESSES:\n"
            "• Otitis media — amoxicillin for bacterial; watchful waiting for mild.\n"
            "• Croup — barking cough; dexamethasone + nebulized epinephrine for severe.\n"
            "• Hand-Foot-Mouth — viral; self-limiting.\n"
            "• Gastroenteritis — ORS; NOT antibiotics for viral.\n"
            "• RSV — serious in infants; supportive care."
        ),
    },
    {
        "title": "Allergies & Anaphylaxis Management",
        "category": "Immunology",
        "keywords": ["allergy", "anaphylaxis", "antihistamine", "EpiPen", "epinephrine", "food allergy", "hay fever", "allergic rhinitis"],
        "content": (
            "Allergic reactions occur when the immune system overreacts to harmless substances. IgE-mediated.\n\n"
            "TYPES:\n"
            "• Allergic rhinitis (hay fever) — pollen, dust mites, pet dander. Treatment: non-sedating antihistamines (cetirizine, loratadine, fexofenadine), intranasal corticosteroids (most effective), montelukast, allergen immunotherapy.\n"
            "• Allergic asthma — allergen-triggered bronchospasm; managed as asthma + allergen avoidance.\n"
            "• Food allergy — IgE-mediated immediate reactions to top 8 allergens (peanuts, tree nuts, shellfish, fish, milk, eggs, wheat, soy). Distinct from food intolerance (e.g., lactose, non-IgE).\n"
            "• Drug allergy — penicillin most common; can cause anaphylaxis.\n"
            "• Latex, insect venom — risk of anaphylaxis; carry EpiPen.\n\n"
            "TESTING: skin prick test, serum specific IgE (RAST), oral food challenge (gold standard for food allergy).\n\n"
            "🚨 ANAPHYLAXIS — life-threatening. Recognition: rapid onset after allergen exposure with bronchospasm, urticaria, angioedema, hypotension, loss of consciousness.\n"
            "Treatment:\n"
            "1. Epinephrine 0.3–0.5 mg IM into anterolateral thigh IMMEDIATELY.\n"
            "2. Call emergency services.\n"
            "3. Lay flat, raise legs (unless respiratory distress).\n"
            "4. Repeat epinephrine every 5–15 min if no improvement.\n"
            "5. IV antihistamines, corticosteroids, fluids — secondary measures only.\n\n"
            "Anyone with a history of anaphylaxis should carry TWO EpiPens at all times and follow up with an allergist.\n\n"
            "ALLERGEN IMMUNOTHERAPY: desensitization injections or sublingual tablets reduce symptoms 70–80% and modify disease course."
        ),
    },
    {
        "title": "Understanding Common Blood Tests",
        "category": "Medical Education",
        "keywords": ["blood test", "CBC", "complete blood count", "LFT", "KFT", "HbA1c", "lipid panel", "lab values", "normal range"],
        "content": (
            "Blood tests are fundamental diagnostic tools. A guide to common results:\n\n"
            "COMPLETE BLOOD COUNT (CBC):\n"
            "• Hemoglobin — men 13–17, women 12–15 g/dL. Low = anemia; high = polycythemia.\n"
            "• WBC — 4,000–11,000/µL. High = infection/inflammation; low = immunosuppression.\n"
            "  – Neutrophils — bacterial infection.\n"
            "  – Lymphocytes — viral infection.\n"
            "  – Eosinophils — allergy, parasites.\n"
            "• Platelets — 150,000–400,000/µL. <100k = bleeding risk; high = clotting/reactive.\n\n"
            "LIVER FUNCTION (LFT):\n"
            "• ALT <40, AST <40 U/L — elevated = liver cell damage.\n"
            "• ALP 30–120 U/L — elevated in liver/bile duct, bone disease.\n"
            "• Bilirubin total <1.2 mg/dL — elevated = jaundice.\n"
            "• Albumin 3.4–5.4 g/dL — low in chronic liver disease, malnutrition, nephrotic syndrome.\n\n"
            "KIDNEY FUNCTION:\n"
            "• Creatinine — men 0.74–1.35, women 0.59–1.04 mg/dL.\n"
            "• eGFR — >60 normal; <60 = CKD.\n"
            "• Urea/BUN — 7–20 mg/dL.\n"
            "• Electrolytes — Na 135–145, K 3.5–5.0 mEq/L.\n\n"
            "GLUCOSE:\n"
            "• Fasting — 70–99 normal, 100–125 prediabetes, ≥126 diabetes.\n"
            "• HbA1c — <5.7% normal, 5.7–6.4% prediabetes, ≥6.5% diabetes.\n\n"
            "THYROID: TSH 0.4–4.0 mIU/L; free T4 0.8–1.8 ng/dL.\n"
            "LIPID PANEL: total <200, LDL <100, HDL >40 (men)/>50 (women), TG <150 mg/dL.\n"
            "VITAMIN D (25-OH): 30–100 sufficient, 20–30 insufficient, <20 deficient ng/mL."
        ),
    },
    {
        "title": "Medical Procedures — What to Expect",
        "category": "Medical Education",
        "keywords": ["medical procedure", "endoscopy", "colonoscopy", "MRI", "CT scan", "ECG", "echocardiogram", "biopsy", "anesthesia"],
        "content": (
            "Understanding common medical procedures helps reduce anxiety and improve compliance.\n\n"
            "CARDIAC:\n"
            "• ECG — painless, 10 electrodes, 5 minutes; detects arrhythmias, MI, LVH.\n"
            "• Echocardiogram — heart ultrasound; structure and function; 30–60 min; no radiation.\n"
            "• Stress test — ECG during exercise or pharmacological stress.\n"
            "• Cardiac catheterization/angiography — contrast injected via wrist/groin catheter; gold standard for CAD.\n\n"
            "IMAGING:\n"
            "• X-ray — quick, low radiation; chest, bones.\n"
            "• Ultrasound — safe, no radiation; abdomen, pelvis, thyroid, vascular Doppler.\n"
            "• CT — multiple X-ray slices; detailed anatomy; moderate radiation; often with contrast (check kidney function).\n"
            "• MRI — magnets + radio waves; no radiation; excellent soft-tissue detail; 30–90 min; check for metal implants.\n"
            "• PET — radioactive glucose; detects active cancer/metabolic activity.\n\n"
            "ENDOSCOPY:\n"
            "• Gastroscopy (OGD) — flexible camera via mouth; fasting required; throat spray ± sedation.\n"
            "• Colonoscopy — camera via rectum; bowel prep day before; sedation given; gold standard for colorectal cancer screening.\n\n"
            "BIOPSY: small tissue sample for pathology; image-guided, endoscopic, or surgical. Results usually 5–7 days.\n\n"
            "ANESTHESIA TYPES:\n"
            "• Local — numbs small area; awake.\n"
            "• Regional — numbs larger area (spinal, epidural).\n"
            "• General — full unconsciousness with ventilator support.\n\n"
            "PRE-OP: typically nothing by mouth 6–8 h (solids) / 2–4 h (clear fluids); review meds; stop anticoagulants/metformin as advised."
        ),
    },
    {
        "title": "Arthritis — Osteoarthritis, Rheumatoid Arthritis & Gout",
        "category": "Musculoskeletal",
        "keywords": ["arthritis", "osteoarthritis", "rheumatoid arthritis", "gout", "joint pain", "DMARDs", "methotrexate", "uric acid"],
        "content": (
            "OSTEOARTHRITIS (OA): degenerative joint disease — cartilage breakdown; common in knee, hip, hands, spine.\n"
            "Risk factors: age, obesity, prior injury, family history, repetitive use.\n"
            "Symptoms: use-related joint pain, stiffness <30 min after rest, crepitus, reduced ROM. No systemic features.\n"
            "Management:\n"
            "• Non-pharmacological — weight loss (#1 for knee OA), physiotherapy, low-impact exercise, walking aids.\n"
            "• Pharmacological — topical NSAIDs (first-line for knee/hand OA), oral NSAIDs (GI risk), paracetamol, intra-articular corticosteroid injections.\n"
            "• Surgery — joint replacement for severe disease.\n\n"
            "RHEUMATOID ARTHRITIS (RA): systemic autoimmune disease; symmetric small-joint involvement (MCPs, PIPs, wrists).\n"
            "Features: morning stiffness >60 min, swollen/tender joints, RF/anti-CCP positive, ↑ESR/CRP.\n"
            "Extra-articular: nodules, lung disease, vasculitis, eye inflammation, ↑CV risk.\n"
            "Treatment:\n"
            "• DMARDs — methotrexate (first-line); hydroxychloroquine, sulfasalazine, leflunomide.\n"
            "• Biologic DMARDs — TNF inhibitors (adalimumab), IL-6 inhibitors (tocilizumab), JAK inhibitors (baricitinib).\n"
            "• NSAIDs + short-course steroids for flares.\n"
            "• Treat-to-target → DAS28 remission.\n\n"
            "GOUT: hyperuricemia → urate crystal deposition → acute joint inflammation (often big toe).\n"
            "Acute attack — NSAIDs, colchicine, or corticosteroids.\n"
            "Prevention — allopurinol (urate-lowering); avoid purine-rich foods, alcohol, fructose."
        ),
    },
    {
        "title": "Obesity & Weight Management",
        "category": "Metabolic",
        "keywords": ["obesity", "BMI", "weight loss", "bariatric", "diet", "overweight", "metabolic syndrome", "weight management", "semaglutide"],
        "content": (
            "Obesity is a chronic disease characterized by excess body fat that increases health risks. BMI ≥30 kg/m² = obesity; 25–29.9 = overweight.\n\n"
            "HEALTH CONSEQUENCES:\n"
            "• Metabolic — T2DM, dyslipidemia, metabolic syndrome.\n"
            "• Cardiovascular — hypertension, CAD, heart failure, stroke, AF.\n"
            "• Musculoskeletal — osteoarthritis, gout, low back pain.\n"
            "• Cancer — breast, colon, endometrial, kidney, liver risk increased.\n"
            "• Sleep — obstructive sleep apnea.\n"
            "• Mental health — depression, low self-esteem.\n"
            "• Reproductive — infertility, PCOS, pregnancy complications.\n\n"
            "ASSESSMENT:\n"
            "• BMI — overweight 25–29.9; Obese I 30–34.9; II 35–39.9; III ≥40.\n"
            "• Waist circumference — >94 cm men / >80 cm women (South Asians: >90/>80) = abdominal adiposity.\n\n"
            "MANAGEMENT:\n"
            "1. Lifestyle — caloric deficit 500–750 kcal/day → 0.5–1 kg/week loss; Mediterranean or low-calorie diet; ≥150 min/week exercise; behavioral therapy.\n"
            "2. Anti-obesity medications (BMI ≥30 or ≥27 with comorbidities):\n"
            "   • Semaglutide (Wegovy/Ozempic) — GLP-1 agonist; up to 15–17% loss; current gold standard.\n"
            "   • Tirzepatide (Mounjaro) — GIP+GLP-1; up to 20–22% loss.\n"
            "   • Orlistat — lipase inhibitor; 5–10% loss; GI side effects.\n"
            "3. Bariatric surgery (BMI ≥40 or ≥35 with severe comorbidities):\n"
            "   • Sleeve gastrectomy, Roux-en-Y gastric bypass — 25–35% loss; T2DM remission.\n\n"
            "Even 5–10% weight loss produces significant health benefits."
        ),
    },
]


# ════════════════════════════════════════════════════════════════════════════
#  RETRIEVER
# ════════════════════════════════════════════════════════════════════════════

class HealthcareKnowledgeRetriever:
    """
    In-process RAG retriever using TF-IDF + cosine similarity.

    Public interface (kept stable so a future swap to Pinecone/Chroma is easy):
        - retrieve(query, k) -> list[dict]
        - format_context(docs) -> str
    """

    # Articles below this score are not considered relevant enough to inject
    MIN_RELEVANCE_SCORE = 0.04

    def __init__(self, articles: list[dict[str, Any]] | None = None):
        self._docs = articles if articles is not None else MEDICAL_KNOWLEDGE_BASE
        self._vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),     # unigrams + bigrams capture phrase context
            stop_words="english",
            max_features=8000,
            sublinear_tf=True,      # log-scaled term frequency
            min_df=1,
        )
        # Build the indexed corpus: title + keywords (weighted) + content
        corpus = [
            f"{doc['title']} {doc['title']} "                    # double-weight title
            f"{' '.join(doc['keywords'])} {' '.join(doc['keywords'])} "  # double-weight keywords
            f"{doc['content']}"
            for doc in self._docs
        ]
        self._matrix = self._vectorizer.fit_transform(corpus)
        logger.info(
            "HealthcareKnowledgeRetriever indexed %d articles "
            "(vocab=%d, dim=%d)",
            len(self._docs),
            len(self._vectorizer.vocabulary_),
            self._matrix.shape[1],
        )

    def retrieve(self, query: str, k: int = 3) -> list[dict[str, Any]]:
        """
        Return the top-k most relevant articles for `query`.
        Articles below MIN_RELEVANCE_SCORE are filtered out.
        """
        if not query or not query.strip():
            return []
        q_vec = self._vectorizer.transform([query])
        sims = cosine_similarity(q_vec, self._matrix).flatten()
        top_indices = np.argsort(sims)[::-1][:k]
        results: list[dict[str, Any]] = []
        for idx in top_indices:
            score = float(sims[idx])
            if score >= self.MIN_RELEVANCE_SCORE:
                results.append({
                    "title":           self._docs[idx]["title"],
                    "category":        self._docs[idx]["category"],
                    "content":         self._docs[idx]["content"],
                    "relevance_score": score,
                })
        return results

    def format_context(self, docs: list[dict[str, Any]]) -> str:
        """Format retrieved articles into a context block for Claude's system prompt."""
        if not docs:
            return ""
        lines = ["[RETRIEVED HEALTHCARE KNOWLEDGE]", ""]
        for i, doc in enumerate(docs, 1):
            lines.append(f"--- Source {i}: {doc['title']} ({doc['category']}) ---")
            lines.append(doc["content"])
            lines.append("")
        lines.append("[END RETRIEVED CONTEXT]")
        return "\n".join(lines)

    def article_count(self) -> int:
        return len(self._docs)
