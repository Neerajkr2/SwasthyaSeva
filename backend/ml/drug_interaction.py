# backend/ml/drug_interaction.py
"""
Drug & Food Interaction Checker — Module 4
==========================================
Enhanced clinical rule engine with:
  • Drug-drug interaction database (18+ rules, fuzzy matching)
  • Food-drug interaction database (25+ rules)
  • Drug class/category mapping for 60+ medications
  • Timing & administration advice
  • Alternative medication suggestions
  • Safety scoring (0-100)
"""
from __future__ import annotations
import logging, re
from itertools import combinations
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# ═════════════════════════════════════════════════════════════════════════════
#  DRUG-DRUG INTERACTION DATABASE
# ═════════════════════════════════════════════════════════════════════════════
INTERACTIONS_DB: List[Dict] = [
    # ── Anticoagulants ────────────────────────────────────────────────────
    {
        "drugs_a": ["warfarin", "coumadin"],
        "drugs_b": ["aspirin", "acetylsalicylic acid", "asa"],
        "severity": "major",
        "description": "Warfarin + Aspirin: Both inhibit clotting. Co-use dramatically increases bleeding risk, including GI and intracranial hemorrhage.",
        "action": "Avoid combination unless under close medical supervision. Use lowest effective aspirin dose only when clearly indicated.",
        "mechanism": "Pharmacodynamic — additive anticoagulant/antiplatelet effects",
    },
    {
        "drugs_a": ["warfarin", "coumadin"],
        "drugs_b": ["ibuprofen", "advil", "nurofen", "naproxen", "diclofenac"],
        "severity": "major",
        "description": "Warfarin + NSAIDs: NSAIDs inhibit platelet function and may displace warfarin from protein binding, elevating INR and bleeding risk.",
        "action": "Avoid NSAIDs with warfarin. Use paracetamol (acetaminophen) for pain relief. Monitor INR closely if NSAID use is unavoidable.",
        "mechanism": "Pharmacokinetic (protein displacement) + Pharmacodynamic (additive bleeding)",
    },
    {
        "drugs_a": ["warfarin", "coumadin"],
        "drugs_b": ["fluconazole", "metronidazole", "amoxicillin-clavulanate", "ciprofloxacin"],
        "severity": "moderate",
        "description": "Antibiotics/antifungals can inhibit CYP2C9, increasing warfarin plasma levels and INR.",
        "action": "Monitor INR closely when starting or stopping these medications. Dose adjustment may be needed.",
        "mechanism": "Pharmacokinetic — CYP2C9 inhibition increases warfarin levels",
    },
    # ── SSRIs & MAOIs ─────────────────────────────────────────────────────
    {
        "drugs_a": ["sertraline", "zoloft", "fluoxetine", "prozac", "paroxetine", "escitalopram", "citalopram"],
        "drugs_b": ["phenelzine", "tranylcypromine", "isocarboxazid", "selegiline", "rasagiline", "linezolid"],
        "severity": "contraindicated",
        "description": "SSRI + MAOI: Combination can cause life-threatening serotonin syndrome — agitation, hyperthermia, tachycardia, seizures.",
        "action": "DO NOT combine. Allow at least 14 days after stopping MAOI before starting SSRI (5 weeks for fluoxetine).",
        "mechanism": "Pharmacodynamic — excessive serotonin accumulation",
    },
    {
        "drugs_a": ["tramadol", "ultram"],
        "drugs_b": ["sertraline", "fluoxetine", "paroxetine", "escitalopram", "duloxetine"],
        "severity": "major",
        "description": "Tramadol + SSRIs: Increased serotonin syndrome risk. SSRIs also inhibit CYP2D6, altering tramadol metabolism.",
        "action": "Avoid combination. If necessary, use lowest effective doses and monitor for serotonin syndrome symptoms.",
        "mechanism": "Pharmacodynamic (serotonin) + Pharmacokinetic (CYP2D6 inhibition)",
    },
    # ── Statins ───────────────────────────────────────────────────────────
    {
        "drugs_a": ["simvastatin", "lovastatin", "atorvastatin"],
        "drugs_b": ["clarithromycin", "erythromycin", "azithromycin", "itraconazole", "ketoconazole"],
        "severity": "major",
        "description": "Statin + CYP3A4 inhibitors: Dramatically increases statin plasma levels, raising risk of rhabdomyolysis and renal failure.",
        "action": "Suspend statin or switch to a non-interacting statin (rosuvastatin, pravastatin) during antibiotic/antifungal therapy.",
        "mechanism": "Pharmacokinetic — CYP3A4 inhibition increases statin exposure",
    },
    # ── Antihypertensives ─────────────────────────────────────────────────
    {
        "drugs_a": ["amlodipine", "nifedipine", "lisinopril", "ramipril", "enalapril"],
        "drugs_b": ["potassium", "spironolactone", "eplerenone", "amiloride"],
        "severity": "moderate",
        "description": "ACE inhibitor + potassium-sparing agents: Risk of hyperkalemia causing fatal arrhythmias.",
        "action": "Monitor serum potassium regularly. Avoid excessive potassium supplementation.",
        "mechanism": "Pharmacodynamic — additive potassium retention",
    },
    {
        "drugs_a": ["metformin"],
        "drugs_b": ["alcohol", "ethanol"],
        "severity": "moderate",
        "description": "Metformin + Alcohol: Increased risk of lactic acidosis, especially in liver or kidney impairment.",
        "action": "Limit or avoid alcohol while taking metformin. Report symptoms of lactic acidosis immediately.",
        "mechanism": "Pharmacodynamic — both impair hepatic lactate clearance",
    },
    # ── Diabetes drugs ────────────────────────────────────────────────────
    {
        "drugs_a": ["glibenclamide", "glipizide", "glimepiride", "glyburide"],
        "drugs_b": ["fluconazole", "ciprofloxacin"],
        "severity": "moderate",
        "description": "Sulfonylurea + Fluconazole/Quinolones: Inhibits sulfonylurea metabolism, causing hypoglycemia.",
        "action": "Monitor blood glucose closely. Dose reduction of sulfonylurea may be required.",
        "mechanism": "Pharmacokinetic — CYP2C9 inhibition increases sulfonylurea levels",
    },
    # ── CNS Depressants ───────────────────────────────────────────────────
    {
        "drugs_a": ["diazepam", "alprazolam", "lorazepam", "clonazepam", "midazolam"],
        "drugs_b": ["oxycodone", "morphine", "codeine", "tramadol", "fentanyl", "hydrocodone"],
        "severity": "major",
        "description": "Benzodiazepine + Opioid: Combined CNS and respiratory depression implicated in many overdose deaths.",
        "action": "Avoid combination whenever possible. If required, use lowest effective doses and have naloxone available.",
        "mechanism": "Pharmacodynamic — additive CNS and respiratory depression",
    },
    {
        "drugs_a": ["diazepam", "alprazolam", "clonazepam"],
        "drugs_b": ["alcohol", "ethanol"],
        "severity": "major",
        "description": "Benzodiazepine + Alcohol: Profound CNS and respiratory depression, risk of coma and death.",
        "action": "Completely avoid alcohol while taking benzodiazepines.",
        "mechanism": "Pharmacodynamic — additive GABA-ergic CNS depression",
    },
    # ── Antibiotics ───────────────────────────────────────────────────────
    {
        "drugs_a": ["metronidazole", "flagyl", "tinidazole"],
        "drugs_b": ["alcohol", "ethanol"],
        "severity": "major",
        "description": "Metronidazole + Alcohol: Disulfiram-like reaction — severe nausea, vomiting, flushing, palpitations.",
        "action": "Avoid all alcohol during treatment and for 48 hours after completion.",
        "mechanism": "Pharmacokinetic — aldehyde dehydrogenase inhibition",
    },
    {
        "drugs_a": ["ciprofloxacin", "levofloxacin", "moxifloxacin"],
        "drugs_b": ["antacids", "calcium", "iron", "magnesium", "aluminium"],
        "severity": "moderate",
        "description": "Fluoroquinolones + Polyvalent cations: Chelation significantly reduces quinolone absorption.",
        "action": "Take fluoroquinolones 2 hours before or 6 hours after antacids, calcium, iron, or magnesium.",
        "mechanism": "Pharmacokinetic — chelation reduces oral bioavailability",
    },
    # ── Contraceptives ────────────────────────────────────────────────────
    {
        "drugs_a": ["oral contraceptive", "birth control pill", "levonorgestrel", "ethinylestradiol"],
        "drugs_b": ["rifampicin", "rifampin", "carbamazepine", "phenytoin", "phenobarbital", "topiramate"],
        "severity": "major",
        "description": "Enzyme inducers reduce oral contraceptive levels, risking contraceptive failure.",
        "action": "Use additional non-hormonal contraception. Discuss alternatives with your doctor.",
        "mechanism": "Pharmacokinetic — CYP3A4 induction increases hormone metabolism",
    },
    # ── Cardiac ──────────────────────────────────────────────────────────
    {
        "drugs_a": ["digoxin", "lanoxin"],
        "drugs_b": ["amiodarone", "verapamil", "clarithromycin", "itraconazole"],
        "severity": "major",
        "description": "Digoxin + P-gp inhibitors: Elevated digoxin levels leading to toxicity (bradycardia, arrhythmias, visual disturbances).",
        "action": "Reduce digoxin dose by 50%. Monitor digoxin levels and ECG closely.",
        "mechanism": "Pharmacokinetic — P-glycoprotein inhibition reduces digoxin clearance",
    },
    {
        "drugs_a": ["aspirin", "acetylsalicylic acid"],
        "drugs_b": ["ibuprofen", "naproxen", "celecoxib"],
        "severity": "moderate",
        "description": "Aspirin + NSAIDs: Increased GI bleeding risk. NSAIDs may diminish aspirin's antiplatelet effect.",
        "action": "Avoid combination if possible. If both required, take aspirin 30 minutes before ibuprofen.",
        "mechanism": "Pharmacodynamic — competitive COX-1 binding + additive GI toxicity",
    },
    # ── Immunosuppressants ────────────────────────────────────────────────
    {
        "drugs_a": ["cyclosporine", "tacrolimus"],
        "drugs_b": ["clarithromycin", "erythromycin", "ketoconazole", "itraconazole", "fluconazole"],
        "severity": "major",
        "description": "Immunosuppressants + CYP3A4 inhibitors: Dramatically increased levels causing nephrotoxicity and neurotoxicity.",
        "action": "Avoid combination. If unavoidable, reduce dose significantly and monitor drug levels.",
        "mechanism": "Pharmacokinetic — CYP3A4 inhibition increases immunosuppressant exposure",
    },
    # ── Thyroid ───────────────────────────────────────────────────────────
    {
        "drugs_a": ["levothyroxine", "synthroid", "thyronorm"],
        "drugs_b": ["calcium", "iron", "antacids", "omeprazole", "pantoprazole"],
        "severity": "moderate",
        "description": "Levothyroxine absorption is reduced by calcium, iron, antacids, and PPIs, leading to subtherapeutic levels.",
        "action": "Take levothyroxine on an empty stomach, 4 hours apart from calcium/iron and 30 min before PPIs.",
        "mechanism": "Pharmacokinetic — reduced GI absorption via chelation or pH change",
    },
]


# ═════════════════════════════════════════════════════════════════════════════
#  FOOD-DRUG INTERACTION DATABASE
# ═════════════════════════════════════════════════════════════════════════════
FOOD_INTERACTIONS_DB: List[Dict] = [
    {
        "drugs": ["warfarin", "coumadin"],
        "food": "Vitamin K-rich foods",
        "examples": ["spinach", "kale", "broccoli", "Brussels sprouts", "green tea"],
        "severity": "major",
        "effect": "Vitamin K counteracts warfarin's anticoagulant action, reducing INR and increasing clot risk.",
        "advice": "Maintain CONSISTENT vitamin K intake — don't suddenly increase or decrease green vegetable consumption.",
    },
    {
        "drugs": ["simvastatin", "lovastatin", "atorvastatin", "felodipine", "cyclosporine", "tacrolimus"],
        "food": "Grapefruit / grapefruit juice",
        "examples": ["grapefruit", "pomelo", "Seville orange"],
        "severity": "major",
        "effect": "Grapefruit inhibits CYP3A4 in the gut wall, dramatically increasing drug absorption and blood levels.",
        "advice": "Avoid grapefruit entirely while on these medications. One glass can affect drug levels for up to 72 hours.",
    },
    {
        "drugs": ["metformin", "glibenclamide", "glipizide", "glimepiride", "insulin"],
        "food": "Alcohol",
        "examples": ["beer", "wine", "spirits", "cocktails"],
        "severity": "major",
        "effect": "Alcohol can cause severe hypoglycemia with diabetes medications and lactic acidosis with metformin.",
        "advice": "Limit alcohol to 1 drink/day for women, 2/day for men. Never drink on an empty stomach while on these meds.",
    },
    {
        "drugs": ["tetracycline", "doxycycline", "minocycline"],
        "food": "Dairy products",
        "examples": ["milk", "cheese", "yogurt", "calcium supplements"],
        "severity": "moderate",
        "effect": "Calcium in dairy chelates with tetracyclines, reducing absorption by up to 65%.",
        "advice": "Take tetracyclines 1 hour before or 2 hours after dairy products or calcium supplements.",
    },
    {
        "drugs": ["ciprofloxacin", "levofloxacin", "norfloxacin"],
        "food": "Dairy and calcium-fortified foods",
        "examples": ["milk", "yogurt", "calcium-fortified orange juice", "antacids"],
        "severity": "moderate",
        "effect": "Calcium, iron, and zinc chelate with fluoroquinolones, significantly reducing their efficacy.",
        "advice": "Take fluoroquinolones 2 hours before or 6 hours after dairy/mineral products.",
    },
    {
        "drugs": ["phenelzine", "tranylcypromine", "isocarboxazid", "selegiline"],
        "food": "Tyramine-rich foods",
        "examples": ["aged cheese", "cured meats", "soy sauce", "draft beer", "fermented foods", "sauerkraut"],
        "severity": "contraindicated",
        "effect": "MAOIs prevent tyramine breakdown, causing hypertensive crisis — severe headache, stroke risk.",
        "advice": "STRICTLY avoid all tyramine-rich foods while on MAOIs and for 2 weeks after stopping.",
    },
    {
        "drugs": ["levothyroxine", "synthroid", "thyronorm"],
        "food": "Soy products and high-fiber foods",
        "examples": ["soy milk", "tofu", "edamame", "soy protein", "bran cereals"],
        "severity": "moderate",
        "effect": "Soy and fiber can interfere with levothyroxine absorption, reducing thyroid hormone levels.",
        "advice": "Take levothyroxine 30-60 minutes before breakfast on an empty stomach. Separate from soy by 4 hours.",
    },
    {
        "drugs": ["metronidazole", "flagyl", "tinidazole"],
        "food": "Alcohol",
        "examples": ["beer", "wine", "spirits", "alcohol-containing mouthwash"],
        "severity": "major",
        "effect": "Causes disulfiram-like reaction: severe nausea, vomiting, flushing, rapid heart rate.",
        "advice": "Avoid ALL alcohol (including mouthwash) during treatment and 48 hours after the last dose.",
    },
    {
        "drugs": ["amlodipine", "nifedipine", "verapamil", "diltiazem"],
        "food": "Grapefruit",
        "examples": ["grapefruit", "grapefruit juice"],
        "severity": "moderate",
        "effect": "Grapefruit increases calcium channel blocker levels, causing excessive blood pressure drop and dizziness.",
        "advice": "Avoid grapefruit while on calcium channel blockers. Switch to other citrus fruits like oranges.",
    },
    {
        "drugs": ["spironolactone", "lisinopril", "ramipril", "enalapril", "losartan", "valsartan"],
        "food": "Potassium-rich foods (in excess)",
        "examples": ["bananas", "oranges", "potatoes", "tomatoes", "salt substitutes"],
        "severity": "moderate",
        "effect": "These drugs already increase potassium retention. Excess dietary potassium can cause hyperkalemia.",
        "advice": "Don't avoid potassium entirely — just maintain a normal, balanced intake. Avoid salt substitutes (KCl).",
    },
    {
        "drugs": ["iron", "ferrous sulfate", "ferrous fumarate", "ferrous gluconate"],
        "food": "Tea, coffee, and calcium",
        "examples": ["tea", "coffee", "milk", "cheese", "calcium supplements"],
        "severity": "moderate",
        "effect": "Tannins in tea/coffee and calcium reduce iron absorption by 40-60%.",
        "advice": "Take iron supplements 1-2 hours before or after tea/coffee/dairy. Vitamin C enhances iron absorption.",
    },
    {
        "drugs": ["aspirin", "ibuprofen", "naproxen", "diclofenac", "celecoxib"],
        "food": "Alcohol",
        "examples": ["beer", "wine", "spirits"],
        "severity": "moderate",
        "effect": "Both NSAIDs and alcohol irritate the stomach lining, dramatically increasing GI bleeding risk.",
        "advice": "Avoid or strictly limit alcohol while taking NSAIDs. Take NSAIDs with food to reduce stomach irritation.",
    },
    {
        "drugs": ["lithium"],
        "food": "Caffeine and salt",
        "examples": ["coffee", "energy drinks", "high-salt foods"],
        "severity": "moderate",
        "effect": "Caffeine increases lithium excretion, reducing levels. Sudden salt changes affect lithium clearance.",
        "advice": "Keep caffeine and salt intake consistent. Sudden changes can cause lithium toxicity or subtherapeutic levels.",
    },
    {
        "drugs": ["digoxin", "lanoxin"],
        "food": "High-fiber foods and St. John's Wort",
        "examples": ["bran", "oatmeal", "high-fiber cereals", "St. John's Wort"],
        "severity": "moderate",
        "effect": "Fiber reduces digoxin absorption. St. John's Wort induces P-gp, lowering digoxin levels.",
        "advice": "Take digoxin 2 hours apart from high-fiber meals. Avoid St. John's Wort completely.",
    },
    {
        "drugs": ["omeprazole", "pantoprazole", "esomeprazole", "lansoprazole", "rabeprazole"],
        "food": "Food in general",
        "examples": ["any food"],
        "severity": "minor",
        "effect": "PPIs work best on an empty stomach, 30 minutes before meals, when proton pumps are most active.",
        "advice": "Take PPIs 30 minutes before your first meal of the day for maximum effectiveness.",
    },
    {
        "drugs": ["sildenafil", "tadalafil", "vardenafil"],
        "food": "High-fat meals and grapefruit",
        "examples": ["fatty foods", "fried foods", "grapefruit"],
        "severity": "moderate",
        "effect": "High-fat meals delay absorption significantly. Grapefruit increases drug levels and side effects.",
        "advice": "Take on an empty or light stomach for faster onset. Avoid grapefruit.",
    },
    {
        "drugs": ["bisphosphonate", "alendronate", "risedronate", "ibandronate"],
        "food": "Food, calcium, coffee, orange juice",
        "examples": ["any food", "calcium", "coffee", "orange juice", "mineral water"],
        "severity": "major",
        "effect": "Food and beverages (except plain water) reduce bisphosphonate absorption by up to 60%.",
        "advice": "Take on an empty stomach with plain water ONLY. Wait 30-60 min before eating or drinking anything else.",
    },
    {
        "drugs": ["clopidogrel", "plavix"],
        "food": "Grapefruit",
        "examples": ["grapefruit", "grapefruit juice"],
        "severity": "moderate",
        "effect": "Grapefruit may inhibit CYP2C19, reducing conversion of clopidogrel to its active metabolite.",
        "advice": "Avoid grapefruit while on clopidogrel to maintain its antiplatelet effectiveness.",
    },
]


# ═════════════════════════════════════════════════════════════════════════════
#  DRUG CLASS MAPPING
# ═════════════════════════════════════════════════════════════════════════════
DRUG_CLASSES: Dict[str, Dict[str, Any]] = {
    # Statins
    "atorvastatin":   {"class": "Statin", "category": "Cholesterol", "icon": "💊"},
    "simvastatin":    {"class": "Statin", "category": "Cholesterol", "icon": "💊"},
    "rosuvastatin":   {"class": "Statin", "category": "Cholesterol", "icon": "💊"},
    "lovastatin":     {"class": "Statin", "category": "Cholesterol", "icon": "💊"},
    "pravastatin":    {"class": "Statin", "category": "Cholesterol", "icon": "💊"},
    # ACE Inhibitors
    "lisinopril":     {"class": "ACE Inhibitor", "category": "Blood Pressure", "icon": "❤️"},
    "ramipril":       {"class": "ACE Inhibitor", "category": "Blood Pressure", "icon": "❤️"},
    "enalapril":      {"class": "ACE Inhibitor", "category": "Blood Pressure", "icon": "❤️"},
    # ARBs
    "losartan":       {"class": "ARB", "category": "Blood Pressure", "icon": "❤️"},
    "valsartan":      {"class": "ARB", "category": "Blood Pressure", "icon": "❤️"},
    "telmisartan":    {"class": "ARB", "category": "Blood Pressure", "icon": "❤️"},
    # Calcium Channel Blockers
    "amlodipine":     {"class": "Calcium Channel Blocker", "category": "Blood Pressure", "icon": "❤️"},
    "nifedipine":     {"class": "Calcium Channel Blocker", "category": "Blood Pressure", "icon": "❤️"},
    "verapamil":      {"class": "Calcium Channel Blocker", "category": "Blood Pressure", "icon": "❤️"},
    "diltiazem":      {"class": "Calcium Channel Blocker", "category": "Blood Pressure", "icon": "❤️"},
    # Beta Blockers
    "atenolol":       {"class": "Beta Blocker", "category": "Blood Pressure", "icon": "❤️"},
    "metoprolol":     {"class": "Beta Blocker", "category": "Blood Pressure", "icon": "❤️"},
    "propranolol":    {"class": "Beta Blocker", "category": "Blood Pressure", "icon": "❤️"},
    # Diabetes
    "metformin":      {"class": "Biguanide", "category": "Diabetes", "icon": "🩸"},
    "glibenclamide":  {"class": "Sulfonylurea", "category": "Diabetes", "icon": "🩸"},
    "glipizide":      {"class": "Sulfonylurea", "category": "Diabetes", "icon": "🩸"},
    "glimepiride":    {"class": "Sulfonylurea", "category": "Diabetes", "icon": "🩸"},
    "insulin":        {"class": "Insulin", "category": "Diabetes", "icon": "🩸"},
    "sitagliptin":    {"class": "DPP-4 Inhibitor", "category": "Diabetes", "icon": "🩸"},
    # Anticoagulants
    "warfarin":       {"class": "Anticoagulant", "category": "Blood Thinning", "icon": "🩹"},
    "clopidogrel":    {"class": "Antiplatelet", "category": "Blood Thinning", "icon": "🩹"},
    "aspirin":        {"class": "NSAID / Antiplatelet", "category": "Pain / Blood Thinning", "icon": "🩹"},
    # NSAIDs
    "ibuprofen":      {"class": "NSAID", "category": "Pain & Inflammation", "icon": "💢"},
    "naproxen":       {"class": "NSAID", "category": "Pain & Inflammation", "icon": "💢"},
    "diclofenac":     {"class": "NSAID", "category": "Pain & Inflammation", "icon": "💢"},
    "celecoxib":      {"class": "COX-2 Inhibitor", "category": "Pain & Inflammation", "icon": "💢"},
    "paracetamol":    {"class": "Analgesic", "category": "Pain", "icon": "💢"},
    "acetaminophen":  {"class": "Analgesic", "category": "Pain", "icon": "💢"},
    # Opioids
    "tramadol":       {"class": "Opioid Analgesic", "category": "Pain", "icon": "⚕️"},
    "morphine":       {"class": "Opioid", "category": "Pain", "icon": "⚕️"},
    "codeine":        {"class": "Opioid", "category": "Pain", "icon": "⚕️"},
    "oxycodone":      {"class": "Opioid", "category": "Pain", "icon": "⚕️"},
    "fentanyl":       {"class": "Opioid", "category": "Pain", "icon": "⚕️"},
    # Antibiotics
    "amoxicillin":    {"class": "Penicillin", "category": "Antibiotic", "icon": "🦠"},
    "ciprofloxacin":  {"class": "Fluoroquinolone", "category": "Antibiotic", "icon": "🦠"},
    "levofloxacin":   {"class": "Fluoroquinolone", "category": "Antibiotic", "icon": "🦠"},
    "metronidazole":  {"class": "Nitroimidazole", "category": "Antibiotic", "icon": "🦠"},
    "azithromycin":   {"class": "Macrolide", "category": "Antibiotic", "icon": "🦠"},
    "clarithromycin": {"class": "Macrolide", "category": "Antibiotic", "icon": "🦠"},
    "erythromycin":   {"class": "Macrolide", "category": "Antibiotic", "icon": "🦠"},
    "doxycycline":    {"class": "Tetracycline", "category": "Antibiotic", "icon": "🦠"},
    "tetracycline":   {"class": "Tetracycline", "category": "Antibiotic", "icon": "🦠"},
    # Antifungals
    "fluconazole":    {"class": "Azole Antifungal", "category": "Antifungal", "icon": "🦠"},
    "itraconazole":   {"class": "Azole Antifungal", "category": "Antifungal", "icon": "🦠"},
    "ketoconazole":   {"class": "Azole Antifungal", "category": "Antifungal", "icon": "🦠"},
    # SSRIs
    "sertraline":     {"class": "SSRI", "category": "Mental Health", "icon": "🧠"},
    "fluoxetine":     {"class": "SSRI", "category": "Mental Health", "icon": "🧠"},
    "paroxetine":     {"class": "SSRI", "category": "Mental Health", "icon": "🧠"},
    "escitalopram":   {"class": "SSRI", "category": "Mental Health", "icon": "🧠"},
    "citalopram":     {"class": "SSRI", "category": "Mental Health", "icon": "🧠"},
    "duloxetine":     {"class": "SNRI", "category": "Mental Health", "icon": "🧠"},
    # Benzodiazepines
    "diazepam":       {"class": "Benzodiazepine", "category": "Anxiety / Sleep", "icon": "😴"},
    "alprazolam":     {"class": "Benzodiazepine", "category": "Anxiety / Sleep", "icon": "😴"},
    "lorazepam":      {"class": "Benzodiazepine", "category": "Anxiety / Sleep", "icon": "😴"},
    "clonazepam":     {"class": "Benzodiazepine", "category": "Anxiety / Sleep", "icon": "😴"},
    # GI
    "omeprazole":     {"class": "PPI", "category": "Stomach / Acid", "icon": "🫁"},
    "pantoprazole":   {"class": "PPI", "category": "Stomach / Acid", "icon": "🫁"},
    "esomeprazole":   {"class": "PPI", "category": "Stomach / Acid", "icon": "🫁"},
    "ranitidine":     {"class": "H2 Blocker", "category": "Stomach / Acid", "icon": "🫁"},
    # Thyroid
    "levothyroxine":  {"class": "Thyroid Hormone", "category": "Thyroid", "icon": "🦋"},
    # Cardiac
    "digoxin":        {"class": "Cardiac Glycoside", "category": "Heart", "icon": "❤️"},
    "amiodarone":     {"class": "Antiarrhythmic", "category": "Heart", "icon": "❤️"},
    # Steroids
    "prednisolone":   {"class": "Corticosteroid", "category": "Anti-inflammatory", "icon": "💊"},
    "prednisone":     {"class": "Corticosteroid", "category": "Anti-inflammatory", "icon": "💊"},
    "dexamethasone":  {"class": "Corticosteroid", "category": "Anti-inflammatory", "icon": "💊"},
    # Diuretics
    "furosemide":     {"class": "Loop Diuretic", "category": "Blood Pressure", "icon": "❤️"},
    "spironolactone": {"class": "Potassium-sparing Diuretic", "category": "Blood Pressure", "icon": "❤️"},
    "hydrochlorothiazide": {"class": "Thiazide Diuretic", "category": "Blood Pressure", "icon": "❤️"},
}


# ═════════════════════════════════════════════════════════════════════════════
#  TIMING ADVICE DATABASE
# ═════════════════════════════════════════════════════════════════════════════
TIMING_ADVICE: Dict[str, Dict[str, str]] = {
    "levothyroxine":  {"when": "Morning, empty stomach", "detail": "Take 30-60 min before breakfast with water only. No food, coffee, or other meds."},
    "omeprazole":     {"when": "Before breakfast", "detail": "Take 30 min before first meal. Works best when proton pumps are active."},
    "pantoprazole":   {"when": "Before breakfast", "detail": "Take 30 min before first meal on an empty stomach."},
    "metformin":      {"when": "With meals", "detail": "Take with food to reduce GI side effects. Extended-release: take with dinner."},
    "aspirin":        {"when": "With food", "detail": "Take with food or after meals to reduce stomach irritation."},
    "ibuprofen":      {"when": "With food", "detail": "Always take with food or milk to protect the stomach lining."},
    "atorvastatin":   {"when": "Evening preferred", "detail": "Can be taken any time, but evening may be slightly more effective for cholesterol."},
    "simvastatin":    {"when": "Evening, required", "detail": "MUST be taken in the evening — liver produces most cholesterol at night."},
    "amlodipine":     {"when": "Any time, consistent", "detail": "Take at the same time daily. Morning or evening is fine."},
    "lisinopril":     {"when": "Morning preferred", "detail": "Take in the morning for best 24-hour BP coverage. Can cause dry cough."},
    "ramipril":       {"when": "Morning preferred", "detail": "Take in the morning. With or without food."},
    "sertraline":     {"when": "Morning with food", "detail": "Take in the morning with food for better absorption and to avoid insomnia."},
    "fluoxetine":     {"when": "Morning", "detail": "Take in the morning as it can be activating and may cause insomnia."},
    "diazepam":       {"when": "As prescribed", "detail": "Take as directed. Avoid driving and alcohol. Can be taken with or without food."},
    "amoxicillin":    {"when": "Every 8 hours", "detail": "Space doses evenly (3x daily). Complete the full course even if feeling better."},
    "ciprofloxacin":  {"when": "Every 12 hours", "detail": "Take 2 hours before or 6 hours after dairy/antacids. Stay well hydrated."},
    "doxycycline":    {"when": "Morning and evening", "detail": "Take with food and a full glass of water. Stay upright for 30 min after. Avoid dairy."},
    "metronidazole":  {"when": "With food", "detail": "Take with food to reduce nausea. Avoid ALL alcohol during treatment."},
    "iron":           {"when": "Empty stomach, morning", "detail": "Take 1 hour before meals with vitamin C (orange juice). Avoid tea/coffee/dairy."},
    "calcium":        {"when": "With food, divided doses", "detail": "Take with meals for better absorption. Don't exceed 500mg per dose."},
    "warfarin":       {"when": "Same time daily", "detail": "Take at the same time every day (usually evening). Maintain consistent vitamin K diet."},
    "digoxin":        {"when": "Morning, consistent", "detail": "Take at the same time daily. Can be taken with or without food."},
    "furosemide":     {"when": "Morning", "detail": "Take in the morning to avoid nighttime urination. Monitor potassium."},
    "prednisolone":   {"when": "Morning with food", "detail": "Take in the morning to mimic cortisol rhythm. Always take with food."},
}


# ═════════════════════════════════════════════════════════════════════════════
#  ALTERNATIVE DRUGS — safer substitutes for common interactions
# ═════════════════════════════════════════════════════════════════════════════
ALTERNATIVES: Dict[str, List[Dict[str, str]]] = {
    "ibuprofen": [
        {"name": "Paracetamol (Acetaminophen)", "reason": "Safer with blood thinners, less GI risk"},
        {"name": "Topical NSAIDs (Diclofenac gel)", "reason": "Localized pain relief, minimal systemic absorption"},
    ],
    "naproxen": [
        {"name": "Paracetamol", "reason": "Lower GI bleeding risk, safer with anticoagulants"},
    ],
    "simvastatin": [
        {"name": "Rosuvastatin", "reason": "Not metabolized by CYP3A4, fewer drug interactions"},
        {"name": "Pravastatin", "reason": "Not metabolized by CYP3A4, safer with macrolide antibiotics"},
    ],
    "atorvastatin": [
        {"name": "Rosuvastatin", "reason": "Less affected by CYP3A4 inhibitors"},
        {"name": "Pravastatin", "reason": "Minimal CYP3A4 metabolism"},
    ],
    "warfarin": [
        {"name": "Apixaban (Eliquis)", "reason": "No INR monitoring needed, fewer food/drug interactions"},
        {"name": "Rivaroxaban (Xarelto)", "reason": "Fixed dosing, fewer dietary restrictions"},
    ],
    "diazepam": [
        {"name": "Buspirone", "reason": "Non-sedating, no addiction risk, safe with most drugs"},
        {"name": "Hydroxyzine", "reason": "Antihistamine with anxiolytic effect, lower abuse potential"},
    ],
    "tramadol": [
        {"name": "Paracetamol", "reason": "No serotonin risk, safe with SSRIs"},
        {"name": "Topical NSAIDs", "reason": "Localized relief without CNS/serotonin effects"},
    ],
    "metronidazole": [
        {"name": "Amoxicillin-Clavulanate", "reason": "Broad-spectrum alternative without alcohol restriction"},
    ],
    "ciprofloxacin": [
        {"name": "Amoxicillin", "reason": "Fewer chelation issues with minerals/dairy"},
        {"name": "Cefuroxime", "reason": "Broad-spectrum cephalosporin with fewer interactions"},
    ],
}


# ═════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ═════════════════════════════════════════════════════════════════════════════
def _normalise(name: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", name.lower().strip())


def _match_drug(name: str, aliases: List[str]) -> bool:
    n = _normalise(name)
    return any(a in n or n in a for a in [_normalise(a) for a in aliases])


def _get_drug_info(name: str) -> Dict[str, Any]:
    """Look up drug class info by name."""
    n = _normalise(name)
    for drug_name, info in DRUG_CLASSES.items():
        if n == drug_name or drug_name in n or n in drug_name:
            return {
                "name": name,
                "drug_class": info["class"],
                "category": info["category"],
                "icon": info["icon"],
            }
    return {"name": name, "drug_class": "Unknown", "category": "General", "icon": "💊"}


def _get_timing(name: str) -> Dict[str, str] | None:
    """Look up timing advice for a drug."""
    n = _normalise(name)
    for drug_name, advice in TIMING_ADVICE.items():
        if n == drug_name or drug_name in n or n in drug_name:
            return {"drug": name, **advice}
    return None


def _get_alternatives(name: str) -> List[Dict[str, str]]:
    """Look up alternative medications."""
    n = _normalise(name)
    for drug_name, alts in ALTERNATIVES.items():
        if n == drug_name or drug_name in n or n in drug_name:
            return alts
    return []


def _get_food_interactions(drug_names: List[str]) -> List[Dict[str, Any]]:
    """Find all food-drug interactions for the given medications."""
    found = []
    seen = set()
    for drug in drug_names:
        for entry in FOOD_INTERACTIONS_DB:
            if _match_drug(drug, entry["drugs"]):
                key = f"{drug}|{entry['food']}"
                if key not in seen:
                    seen.add(key)
                    found.append({
                        "drug": drug,
                        "food": entry["food"],
                        "examples": entry["examples"],
                        "severity": entry["severity"],
                        "effect": entry["effect"],
                        "advice": entry["advice"],
                    })
    return found


def _calculate_safety_score(
    drug_interactions: List[Dict],
    food_interactions: List[Dict],
) -> int:
    """
    Calculate a safety score from 0-100.
    100 = no interactions, 0 = contraindicated combinations.
    """
    if not drug_interactions and not food_interactions:
        return 100

    score = 100
    severity_penalties = {
        "contraindicated": 40,
        "major": 25,
        "moderate": 12,
        "minor": 5,
    }
    for ix in drug_interactions:
        score -= severity_penalties.get(ix.get("severity", "minor"), 5)
    for fx in food_interactions:
        score -= severity_penalties.get(fx.get("severity", "minor"), 3) // 2

    return max(0, min(100, score))


# ═════════════════════════════════════════════════════════════════════════════
#  MAIN CHECKER CLASS
# ═════════════════════════════════════════════════════════════════════════════
class DrugInteractionChecker:
    """Enhanced drug & food interaction checker with safety scoring."""

    def check(self, drug_names: List[str]) -> dict:
        """Original drug-drug check (backward compatible)."""
        found_interactions = []

        for d1, d2 in combinations(drug_names, 2):
            for entry in INTERACTIONS_DB:
                a_match = _match_drug(d1, entry["drugs_a"]) or _match_drug(d2, entry["drugs_a"])
                b_match = _match_drug(d1, entry["drugs_b"]) or _match_drug(d2, entry["drugs_b"])
                if a_match and b_match:
                    found_interactions.append({
                        "drug1":       d1,
                        "drug2":       d2,
                        "severity":    entry["severity"],
                        "description": entry["description"],
                        "action":      entry["action"],
                        "mechanism":   entry.get("mechanism", ""),
                    })

        has_contraindicated = any(i["severity"] == "contraindicated" for i in found_interactions)
        has_major           = any(i["severity"] == "major"           for i in found_interactions)
        is_safe             = not found_interactions

        if is_safe:
            summary = "✅ No known significant interactions detected between the listed medications. Always consult your pharmacist or physician before starting any new medication."
        elif has_contraindicated:
            summary = "🚫 CONTRAINDICATED COMBINATION DETECTED. One or more drug pairs must not be combined. Seek immediate medical advice."
        elif has_major:
            summary = "🚨 MAJOR INTERACTION(S) DETECTED. These drug combinations can cause serious harm. Consult your doctor immediately before taking them together."
        else:
            summary = "⚠️ MODERATE INTERACTION(S) DETECTED. Monitor closely and consult your doctor or pharmacist."

        return {
            "interactions": found_interactions,
            "safe":         is_safe,
            "summary":      summary,
        }

    def check_comprehensive(self, drug_names: List[str]) -> dict:
        """
        Full analysis: drug-drug, food-drug, timing, alternatives, safety score.
        Returns an enriched result object.
        """
        # 1) Drug-drug interactions
        base = self.check(drug_names)

        # 2) Food-drug interactions
        food_interactions = _get_food_interactions(drug_names)

        # 3) Drug class info
        drug_info = [_get_drug_info(d) for d in drug_names]

        # 4) Timing advice
        timing = []
        for d in drug_names:
            t = _get_timing(d)
            if t:
                timing.append(t)

        # 5) Alternative suggestions (only for drugs involved in interactions)
        alternatives = {}
        interacting_drugs = set()
        for ix in base["interactions"]:
            interacting_drugs.add(ix["drug1"].lower())
            interacting_drugs.add(ix["drug2"].lower())
        for d in drug_names:
            if d.lower() in interacting_drugs:
                alts = _get_alternatives(d)
                if alts:
                    alternatives[d] = alts

        # 6) Safety score
        safety_score = _calculate_safety_score(base["interactions"], food_interactions)

        # 7) Severity breakdown
        severity_counts = {"contraindicated": 0, "major": 0, "moderate": 0, "minor": 0}
        for ix in base["interactions"]:
            sev = ix.get("severity", "minor")
            if sev in severity_counts:
                severity_counts[sev] += 1
        for fx in food_interactions:
            sev = fx.get("severity", "minor")
            if sev in severity_counts:
                severity_counts[sev] += 1

        return {
            **base,
            "food_interactions": food_interactions,
            "drug_info":         drug_info,
            "timing_advice":     timing,
            "alternatives":      alternatives,
            "safety_score":      safety_score,
            "severity_counts":   severity_counts,
        }
