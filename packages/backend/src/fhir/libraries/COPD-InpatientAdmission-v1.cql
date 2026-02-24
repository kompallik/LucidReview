library COPD_InpatientAdmission_v1 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'

// ── ICD-10-CM Diagnosis Codes ─────────────────────────────────────────────────

code "COPD with acute lower respiratory infection":        'J44.0' from "ICD10CM"
code "COPD with acute exacerbation":                       'J44.1' from "ICD10CM"
code "COPD unspecified":                                   'J44.9' from "ICD10CM"
code "Acute respiratory failure unspecified":              'J96.00' from "ICD10CM"
code "Acute respiratory failure with hypoxia":             'J96.01' from "ICD10CM"
code "Acute respiratory failure with hypercapnia":         'J96.09' from "ICD10CM"

code "AF paroxysmal":                                      'I48.0'  from "ICD10CM"
code "Longstanding persistent AF":                         'I48.11' from "ICD10CM"
code "Other persistent AF":                                'I48.19' from "ICD10CM"
code "Chronic AF unspecified":                             'I48.20' from "ICD10CM"
code "Permanent AF":                                       'I48.21' from "ICD10CM"
code "Unspecified AF":                                     'I48.91' from "ICD10CM"
code "Supraventricular tachycardia":                       'I47.1'  from "ICD10CM"
code "Ventricular tachycardia":                            'I47.2'  from "ICD10CM"
code "Ventricular fibrillation":                           'I49.01' from "ICD10CM"
code "Ventricular flutter":                                'I49.02' from "ICD10CM"
code "Ventricular premature depolarization":               'I49.3'  from "ICD10CM"
code "Sick sinus syndrome":                                'I49.5'  from "ICD10CM"

// ── LOINC Observation Codes ───────────────────────────────────────────────────

code "Body temperature":                                   '8310-5'  from "LOINC"
code "SpO2 by pulse oximetry":                             '59408-5' from "LOINC"
code "Arterial pO2":                                       '2703-7'  from "LOINC"
code "Arterial pH":                                        '2744-1'  from "LOINC"
code "Arterial pCO2":                                      '2019-8'  from "LOINC"
code "Systolic blood pressure":                            '8480-6'  from "LOINC"
code "Heart rate":                                         '8867-4'  from "LOINC"
code "Respiratory rate":                                   '9279-1'  from "LOINC"

// ── Parameters ────────────────────────────────────────────────────────────────

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

context Patient

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 — DIAGNOSIS BLOCK
// ═════════════════════════════════════════════════════════════════════════════

// ── 1.1  Active COPD / Respiratory-Failure Diagnosis ─────────────────────────

define "COPDDiagnosisCodes":
  { 'J44.0', 'J44.1', 'J44.9', 'J96.00', 'J96.01', 'J96.09' }

define "HasActiveCOPDDiagnosis":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.code in "COPDDiagnosisCodes")
        and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
  )

// ── 1.2  AECOPD Symptom Leaf Expressions ─────────────────────────────────────
//
//  Cardinal-symptom detection relies on Condition resources whose codes
//  represent the documented symptom, or on Observation resources with a
//  free-text / coded component, depending on how the source EHR surfaces
//  clinical-note findings.  The expressions below use Condition (problem list
//  / encounter diagnosis) as the primary mechanism, which is the most common
//  FHIR R4 representation for structured symptom documentation.  Reviewers
//  should supplement with NLP-derived Observations when available.

define "AcuteDyspneaConditions":
  [Condition] C
    where C.code.coding.exists(coding =>
        coding.system = 'http://snomed.info/sct'
          and coding.code in {
            '230145002',  // Difficulty breathing
            '267036007',  // Dyspnea
            '57676002'    // Shortness of breath
          }
    )
      and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
      and C.onset is not null
      and (
        (C.onset as dateTime) >= (Now() - 30 days)
          or (C.onset as Period).start >= (Now() - 30 days)
      )

define "IncreasedSputumVolumeConditions":
  [Condition] C
    where C.code.coding.exists(coding =>
        coding.system = 'http://snomed.info/sct'
          and coding.code in {
            '248594008',  // Productive cough
            '70142008'    // Increased sputum production
          }
    )
      and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
      and C.onset is not null
      and (
        (C.onset as dateTime) >= (Now() - 30 days)
          or (C.onset as Period).start >= (Now() - 30 days)
      )

define "IncreasedSputumPurulenceConditions":
  [Condition] C
    where C.code.coding.exists(coding =>
        coding.system = 'http://snomed.info/sct'
          and coding.code in {
            '75483001',   // Purulent sputum
            '28743005'    // Purulent discharge
          }
    )
      and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
      and C.onset is not null
      and (
        (C.onset as dateTime) >= (Now() - 30 days)
          or (C.onset as Period).start >= (Now() - 30 days)
      )

define "CardinalSymptomCount":
  ( if exists("AcuteDyspneaConditions") then 1 else 0 )
    + ( if exists("IncreasedSputumVolumeConditions") then 1 else 0 )
    + ( if exists("IncreasedSputumPurulenceConditions") then 1 else 0 )

define "TwoOrMoreCardinalAECOPDSymptoms":
  "CardinalSymptomCount" >= 2

define "AtLeastOneCardinalAECOPDSymptom":
  "CardinalSymptomCount" >= 1

// ── 1.3  Fever ────────────────────────────────────────────────────────────────

define "RecentTemperatureObservations":
  [Observation: "Body temperature"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "FeverPresent":
  exists (
    "RecentTemperatureObservations" O
      where (O.value as Quantity).value >= 38.0
  )

// ── 1.4  Recent URI ───────────────────────────────────────────────────────────

define "URIConditions":
  [Condition] C
    where C.code.coding.exists(coding =>
        coding.system = 'http://hl7.org/fhir/sid/icd-10-cm'
          and coding.code in {
            'J00',   // Acute nasopharyngitis
            'J06.9', // Acute upper respiratory infection unspecified
            'J06.0', // Acute laryngopharyngitis
            'J02.9', // Acute pharyngitis
            'J03.90' // Acute tonsillitis
          }
    )
      and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })

define "URIOnsetWithin5Days":
  exists (
    "URIConditions" C
      where C.onset is not null
        and (
          (C.onset as dateTime) >= (Now() - 5 days)
            or (C.onset as Period).start >= (Now() - 5 days)
        )
  )

// ── 1.5  Composite AECOPD Diagnostic Criteria ────────────────────────────────

define "FeverOrRecentURI":
  "FeverPresent" or "URIOnsetWithin5Days"

define "OneCardinalSymptomPlusFeverOrURI":
  "AtLeastOneCardinalAECOPDSymptom" and "FeverOrRecentURI"

define "AECOPDDiagnosticCriteriaMet":
  "TwoOrMoreCardinalAECOPDSymptoms" or "OneCardinalSymptomPlusFeverOrURI"

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2 — SEVERITY BLOCK
// ═════════════════════════════════════════════════════════════════════════════

// ── 2.1  Severe Dyspnea Unresponsive to Initial Treatment ────────────────────

define "SevereDyspneaUnresponsiveToInitialTreatmentConditions":
  [Condition] C
    where C.code.coding.exists(coding =>
        coding.system = 'http://snomed.info/sct'
          and coding.code in {
            '230145002', // Severe difficulty breathing
            '267036007', // Dyspnea at rest
            '57676002'   // Acute severe dyspnea
          }
    )
      and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
      and C.note.exists(n => n.text.lower() contains 'unresponsive'
          or n.text.lower() contains 'no response'
          or n.text.lower() contains 'failed'
          or n.text.lower() contains 'refractory'
          or n.text.lower() contains 'inadequate response'
          or n.text.lower() contains 'not responding'
      )

define "SevereDyspneaUnresponsiveToInitialTreatment":
  exists ( "SevereDyspneaUnresponsiveToInitialTreatmentConditions" )

// ── 2.2  Hypoxemia on Supplemental Oxygen ────────────────────────────────────

define "RecentSpO2Observations":
  [Observation: "SpO2 by pulse oximetry"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 12 hours)

define "SpO2LessThan90OnO2":
  exists (
    "RecentSpO2Observations" O
      where (O.value as Quantity).value < 90
  )

define "RecentPaO2Observations":
  [Observation: "Arterial pO2"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 12 hours)

define "PaO2LessThan60OnO2":
  exists (
    "RecentPaO2Observations" O
      where (O.value as Quantity).value < 60
  )

define "HypoxemiaOnSupplementalOxygen":
  "SpO2LessThan90OnO2" or "PaO2LessThan60OnO2"

// ── 2.3  Respiratory Acidosis ─────────────────────────────────────────────────

define "RecentArterialPHObservations":
  [Observation: "Arterial pH"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 12 hours)

define "RecentPaCO2Observations":
  [Observation: "Arterial pCO2"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 12 hours)

define "ArterialPHLessThan7Point35":
  exists (
    "RecentArterialPHObservations" O
      where (O.value as Quantity).value < 7.35
  )

define "PaCO2GreaterThan45":
  exists (
    "RecentPaCO2Observations" O
      where (O.value as Quantity).value > 45
  )

define "RespiratoryAcidosisPresent":
  "ArterialPHLessThan7Point35" and "PaCO2GreaterThan45"

// ── 2.4  Altered Mental Status ────────────────────────────────────────────────

define "AlteredMentalStatusConditions":
  [Condition] C
    where C.code.coding.exists(coding =>
        coding.system = 'http://snomed.info/sct'
          and coding.code in {
            '40917007',  // Clouding of consciousness
            '371632003', // Coma
            '130987000', // Acute confusion
            '418290006', // Lethargy
            '52448006'   // Encephalopathy
          }
    )
      and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
      and C.onset is not null
      and (
        (C.onset as dateTime) >= (Now() - 24 hours)
          or (C.onset as Period).start >= (Now() - 24 hours)
      )

define "AlteredMentalStatusPresent":
  exists ( "AlteredMentalStatusConditions" )

// ── 2.5  Hemodynamic Instability ─────────────────────────────────────────────

define "RecentSBPObservations":
  [Observation: "Systolic blood pressure"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O