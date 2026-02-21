"""
Lightweight clinical NLP REST service using medspaCy.
Stand-in for Apache cTAKES — swap for the real thing in production.

Endpoints:
  POST /analyze  — extract clinical entities from text
  GET  /health   — health check
"""

import json
import re
from flask import Flask, request, jsonify

import spacy
import medspacy
from medspacy.ner import TargetRule

app = Flask(__name__)

# ---------------------------------------------------------------------------
# NLP pipeline setup
# ---------------------------------------------------------------------------
# Disable the parser to avoid conflict with PyRuSH sentencizer (spaCy E043)
nlp = medspacy.load("en_core_web_sm", disable=["parser"])

# Add target rules for common clinical entity types
target_matcher = nlp.get_pipe("medspacy_target_matcher")

# Problem / condition rules
problem_rules = [
    TargetRule("acute respiratory failure", "PROBLEM", pattern=None),
    TargetRule("respiratory failure", "PROBLEM", pattern=None),
    TargetRule("COPD", "PROBLEM", pattern=None),
    TargetRule("COPD exacerbation", "PROBLEM", pattern=None),
    TargetRule("chronic obstructive pulmonary disease", "PROBLEM", pattern=None),
    TargetRule("pneumonia", "PROBLEM", pattern=None),
    TargetRule("sepsis", "PROBLEM", pattern=None),
    TargetRule("dyspnea", "PROBLEM", pattern=None),
    TargetRule("shortness of breath", "PROBLEM", pattern=None),
    TargetRule("hypoxia", "PROBLEM", pattern=None),
    TargetRule("hypercapnia", "PROBLEM", pattern=None),
    TargetRule("pulmonary embolism", "PROBLEM", pattern=None),
    TargetRule("congestive heart failure", "PROBLEM", pattern=None),
    TargetRule("heart failure", "PROBLEM", pattern=None),
    TargetRule("chest pain", "PROBLEM", pattern=None),
    TargetRule("fever", "PROBLEM", pattern=None),
    TargetRule("cough", "PROBLEM", pattern=None),
    TargetRule("wheezing", "PROBLEM", pattern=None),
    TargetRule("hyperinflation", "PROBLEM", pattern=None),
]

# Medication rules
medication_rules = [
    TargetRule("steroids", "MEDICATION", pattern=None),
    TargetRule("IV steroids", "MEDICATION", pattern=None),
    TargetRule("bronchodilators", "MEDICATION", pattern=None),
    TargetRule("supplemental O2", "MEDICATION", pattern=None),
    TargetRule("supplemental oxygen", "MEDICATION", pattern=None),
    TargetRule("albuterol", "MEDICATION", pattern=None),
    TargetRule("ipratropium", "MEDICATION", pattern=None),
    TargetRule("prednisone", "MEDICATION", pattern=None),
    TargetRule("methylprednisolone", "MEDICATION", pattern=None),
    TargetRule("heparin", "MEDICATION", pattern=None),
    TargetRule("antibiotics", "MEDICATION", pattern=None),
]

# Sign/symptom rules
sign_symptom_rules = [
    TargetRule("accessory muscle use", "SIGN_SYMPTOM", pattern=None),
    TargetRule("decreased breath sounds", "SIGN_SYMPTOM", pattern=None),
    TargetRule("expiratory wheezes", "SIGN_SYMPTOM", pattern=None),
    TargetRule("wheezes", "SIGN_SYMPTOM", pattern=None),
    TargetRule("tachycardia", "SIGN_SYMPTOM", pattern=None),
    TargetRule("tachypnea", "SIGN_SYMPTOM", pattern=None),
    TargetRule("crackles", "SIGN_SYMPTOM", pattern=None),
    TargetRule("rales", "SIGN_SYMPTOM", pattern=None),
    TargetRule("edema", "SIGN_SYMPTOM", pattern=None),
    TargetRule("cyanosis", "SIGN_SYMPTOM", pattern=None),
]

target_matcher.add(problem_rules)
target_matcher.add(medication_rules)
target_matcher.add(sign_symptom_rules)

# ---------------------------------------------------------------------------
# ICD-10 / LOINC code mapping (simplified)
# ---------------------------------------------------------------------------
CODE_MAP = {
    "acute respiratory failure": {"code": "J96.00", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "respiratory failure": {"code": "J96.9", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "copd": {"code": "J44.1", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "copd exacerbation": {"code": "J44.1", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "chronic obstructive pulmonary disease": {"code": "J44.9", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "pneumonia": {"code": "J18.9", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "sepsis": {"code": "A41.9", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "dyspnea": {"code": "R06.00", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "shortness of breath": {"code": "R06.02", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "hypoxia": {"code": "R09.02", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "hypercapnia": {"code": "R06.89", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "chest pain": {"code": "R07.9", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "fever": {"code": "R50.9", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
    "cough": {"code": "R05.9", "system": "http://hl7.org/fhir/sid/icd-10-cm"},
}

# Lab value patterns: (regex, LOINC code, unit, display name)
LAB_PATTERNS = [
    (r"(?:O2\s*[Ss]at|SpO2|SaO2)[:\s]*(\d{1,3})\s*%", "59408-5", "%", "SpO2"),
    (r"pO2[:\s]*(\d{1,3})\s*(?:mmHg)?", "2703-7", "mmHg", "Arterial pO2"),
    (r"pCO2[:\s]*(\d{1,3})\s*(?:mmHg)?", "2019-8", "mmHg", "Arterial pCO2"),
    (r"pH[:\s]*(\d\.\d{1,2})", "2744-1", "[pH]", "Arterial pH"),
    (r"HCO3[:\s]*(\d{1,3})\s*(?:mEq/L|mmol/L)?", "1959-6", "mmol/L", "Bicarbonate"),
    (r"(?:HR|[Hh]eart [Rr]ate)[:\s]*(\d{2,3})", "8867-4", "/min", "Heart rate"),
    (r"(?:RR|[Rr]esp(?:iratory)?\s*[Rr]ate)[:\s]*(\d{1,2})", "9279-1", "/min", "Respiratory rate"),
    (r"(?:BP|[Bb]lood [Pp]ressure)[:\s]*(\d{2,3}/\d{2,3})", "85354-9", "mmHg", "Blood pressure"),
    (r"[Tt]emp(?:erature)?[:\s]*(\d{2}\.\d)\s*(?:C|F)?", "8310-5", "Cel", "Body temperature"),
]

# Negation cues
NEGATION_CUES = [
    "no ", "not ", "denies ", "denied ", "without ", "negative ", "absent ",
    "no evidence of", "ruled out", "rules out", "unlikely",
]


def detect_assertion(text: str, span_start: int, entity_text: str) -> str:
    """Check if the entity is negated based on surrounding context."""
    # Look at a window of text before the entity
    window_start = max(0, span_start - 60)
    preceding_text = text[window_start:span_start].lower()

    for cue in NEGATION_CUES:
        if cue in preceding_text:
            return "negated"
    return "affirmed"


def detect_temporality(text: str, span_start: int) -> str:
    """Detect if the entity refers to historical, current, or hypothetical context."""
    window_start = max(0, span_start - 80)
    preceding = text[window_start:span_start].lower()

    history_cues = ["history of", "h/o", "previous", "prior", "past", "former"]
    for cue in history_cues:
        if cue in preceding:
            return "historical"

    hypothetical_cues = ["if ", "should ", "consider ", "possible ", "suspect"]
    for cue in hypothetical_cues:
        if cue in preceding:
            return "hypothetical"

    return "current"


def extract_lab_values(text: str) -> list:
    """Extract lab/vital values using regex patterns."""
    entities = []
    for pattern, loinc_code, unit, display in LAB_PATTERNS:
        for match in re.finditer(pattern, text):
            value_str = match.group(1)
            span_start = match.start()
            span_end = match.end()
            matched_text = match.group(0)

            entity = {
                "text": matched_text,
                "type": "lab",
                "code": loinc_code,
                "codeSystem": "http://loinc.org",
                "codeDisplay": display,
                "assertion": detect_assertion(text, span_start, matched_text),
                "temporality": detect_temporality(text, span_start),
                "spans": [{"start": span_start, "end": span_end}],
            }

            # Try to parse numeric value
            try:
                if "/" not in value_str:
                    entity["numericValue"] = float(value_str)
                    entity["unit"] = unit
            except ValueError:
                pass

            entities.append(entity)

    return entities


def extract_clinical_entities(text: str) -> list:
    """Run the full NLP pipeline on the input text."""
    entities = []

    # Run medspaCy pipeline for problems, medications, signs/symptoms
    doc = nlp(text)

    for ent in doc.ents:
        entity_text = ent.text
        entity_label = ent.label_

        # Map medspaCy label to our type taxonomy
        type_map = {
            "PROBLEM": "problem",
            "MEDICATION": "medication",
            "SIGN_SYMPTOM": "sign_symptom",
        }
        entity_type = type_map.get(entity_label, "other")

        # Look up code
        code_info = CODE_MAP.get(entity_text.lower(), {})
        code = code_info.get("code")
        code_system = code_info.get("system")

        # Check medspaCy context attributes for negation
        assertion = "affirmed"
        if hasattr(ent, "_") and hasattr(ent._, "is_negated") and ent._.is_negated:
            assertion = "negated"
        else:
            assertion = detect_assertion(text, ent.start_char, entity_text)

        temporality = detect_temporality(text, ent.start_char)

        entities.append({
            "text": entity_text,
            "type": entity_type,
            "code": code,
            "codeSystem": code_system,
            "assertion": assertion,
            "temporality": temporality,
            "spans": [{"start": ent.start_char, "end": ent.end_char}],
        })

    # Extract lab/vital values via regex
    lab_entities = extract_lab_values(text)
    entities.extend(lab_entities)

    # Deduplicate by (text, type, span) — keep first occurrence
    seen = set()
    deduped = []
    for e in entities:
        key = (e["text"].lower(), e["type"], e["spans"][0]["start"])
        if key not in seen:
            seen.add(key)
            deduped.append(e)

    return deduped


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/analyze", methods=["POST"])
def analyze():
    body = request.get_json(force=True)
    text = body.get("text", "")
    if not text:
        return jsonify({"error": "Missing 'text' field"}), 400

    entities = extract_clinical_entities(text)
    return jsonify({"entities": entities})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
