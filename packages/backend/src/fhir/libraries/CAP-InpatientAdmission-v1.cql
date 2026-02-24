library CAP_InpatientAdmission_v1 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'

// ── ICD-10 CAP Diagnosis Codes ────────────────────────────────────────────────
code "Pneumonia, unspecified organism": 'J18.9' from "ICD10CM"
code "Hypostatic pneumonia, unspecified organism": 'J18.1' from "ICD10CM"
code "Bronchopneumonia, unspecified organism": 'J18.0' from "ICD10CM"
code "Unspecified bacterial pneumonia": 'J15.9' from "ICD10CM"
code "Pneumonia due to Klebsiella pneumoniae": 'J15.0' from "ICD10CM"
code "Pneumonia due to Pseudomonas": 'J15.1' from "ICD10CM"
code "Pneumonia due to streptococcus group B": 'J15.3' from "ICD10CM"
code "Pneumonia due to other streptococci": 'J15.4' from "ICD10CM"
code "Pneumonia due to Escherichia coli": 'J15.5' from "ICD10CM"
code "Pneumonia due to other gram-negative bacteria": 'J15.6' from "ICD10CM"
code "Pneumonia due to Mycoplasma pneumoniae": 'J15.7' from "ICD10CM"
code "Pneumonia due to Streptococcus pneumoniae": 'J13' from "ICD10CM"
code "Pneumonia due to Hemophilus influenzae": 'J14' from "ICD10CM"

// ── LOINC Observation Codes ───────────────────────────────────────────────────
code "MMSE score": '72106-8' from "LOINC"
code "BUN lab": '3094-0' from "LOINC"
code "Respiratory rate": '9279-1' from "LOINC"
code "Systolic blood pressure": '8480-6' from "LOINC"
code "Diastolic blood pressure": '8462-4' from "LOINC"
code "Patient age": '21612-7' from "LOINC"
code "SpO2 pulse ox": '59408-5' from "LOINC"
code "Arterial pO2": '2703-7' from "LOINC"
code "PaO2 FiO2 ratio": '50984-4' from "LOINC"
code "WBC count": '6690-2' from "LOINC"
code "Platelet count": '777-3' from "LOINC"
code "Body temperature": '8310-5' from "LOINC"

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

context Patient

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 1 — CAP DIAGNOSIS
// ════════════════════════════════════════════════════════════════════════════════

define "CAP Diagnosis Code List":
  { 'J18.9', 'J18.1', 'J18.0', 'J15.9', 'J15.0', 'J15.1',
    'J15.3', 'J15.4', 'J15.5', 'J15.6', 'J15.7', 'J13', 'J14' }

define "HasCAPDiagnosis":
  exists (
    [Condition] C
      where exists (
        C.code.coding coding
          where coding.system = 'http://hl7.org/fhir/sid/icd-10-cm'
            and coding.code in "CAP Diagnosis Code List"
      )
        and exists (
          C.clinicalStatus.coding s
            where s.code in { 'active', 'recurrence', 'relapse' }
        )
  )

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 2 — CURB-65 COMPONENT CRITERIA
// ════════════════════════════════════════════════════════════════════════════════

// ── 2a. New-Onset Confusion ───────────────────────────────────────────────────

define "Recent MMSE Observations":
  [Observation: "MMSE score"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "MMSELow":
  exists (
    "Recent MMSE Observations" O
      where (O.value as Quantity).value <= 8
  )

define "ConfusionDocumentedInNote":
  exists (
    [Observation] O
      where O.status in { 'final', 'amended', 'corrected' }
        and exists (
          O.code.coding c
            where c.system = 'http://snomed.info/sct'
              and c.code in { '40917007', '418290006', '130987000', '225606002' }
        )
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
  )

define "HasNewOnsetConfusion":
  "MMSELow" or "ConfusionDocumentedInNote"

// ── 2b. BUN Elevated (CURB-65: >19 mg/dL) ───────────────────────────────────

define "Recent BUN Observations":
  [Observation: "BUN lab"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "BUNElevated":
  exists (
    "Recent BUN Observations" O
      where (O.value as Quantity).value > 19
  )

// ── 2c. Respiratory Rate ≥30 breaths/min ─────────────────────────────────────

define "Recent Respiratory Rate Observations":
  [Observation: "Respiratory rate"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "RespiratoryRateElevated":
  exists (
    "Recent Respiratory Rate Observations" O
      where (O.value as Quantity).value >= 30
  )

// ── 2d. Hypotension: SBP <90 or DBP ≤60 ─────────────────────────────────────

define "Recent Systolic BP Observations":
  [Observation: "Systolic blood pressure"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "SystolicBPLow":
  exists (
    "Recent Systolic BP Observations" O
      where (O.value as Quantity).value < 90
  )

define "Recent Diastolic BP Observations":
  [Observation: "Diastolic blood pressure"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "DiastolicBPLow":
  exists (
    "Recent Diastolic BP Observations" O
      where (O.value as Quantity).value <= 60
  )

define "HypotensionMet":
  "SystolicBPLow" or "DiastolicBPLow"

// ── 2e. Age ≥65 ───────────────────────────────────────────────────────────────

define "PatientAgeGTE65":
  AgeInYears() >= 65

// ── 2f. CURB-65 Component Count ──────────────────────────────────────────────

define "CURB65ComponentList":
  {
    if "HasNewOnsetConfusion" then 1 else 0,
    if "BUNElevated" then 1 else 0,
    if "RespiratoryRateElevated" then 1 else 0,
    if "HypotensionMet" then 1 else 0,
    if "PatientAgeGTE65" then 1 else 0
  }

define "CURB65CalculatedScore":
  Sum("CURB65ComponentList")

// ── 2g. CURB-65 Score ≥2 (leaf + wrapper) ────────────────────────────────────

define "CURB65ScoreGreaterThanOrEqualToTwo":
  "CURB65CalculatedScore" >= 2

define "CURB65CriteriaMet":
  "CURB65ScoreGreaterThanOrEqualToTwo"

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 3 — PSI/PORT RISK CLASS
// ════════════════════════════════════════════════════════════════════════════════

define "PSI PORT Class Observations":
  [Observation] O
    where O.status in { 'final', 'amended', 'corrected' }
      and exists (
        O.code.coding c
          where c.system = 'http://loinc.org'
            and c.code = '89243-0'
      )
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "PSIPortClassIIItoV":
  exists (
    "PSI PORT Class Observations" O
      where (O.value as CodeableConcept).coding.code in { 'Class III', 'Class IV', 'Class V' }
  )
  or
  exists (
    [Observation] O
      where O.status in { 'final', 'amended', 'corrected' }
        and exists (
          O.code.coding c
            where c.system = 'http://loinc.org'
              and c.code = '89243-0'
        )
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
        and (O.value as Quantity).value >= 71
  )

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 4 — HYPOXEMIA
// ════════════════════════════════════════════════════════════════════════════════

define "Recent SpO2 Observations":
  [Observation: "SpO2 pulse ox"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "SpO2LowOnRoomAir":
  exists (
    "Recent SpO2 Observations" O
      where (O.value as Quantity).value < 90
  )

define "Recent PaO2 Observations":
  [Observation: "Arterial pO2"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "PaO2LowOnRoomAir":
  exists (
    "Recent PaO2 Observations" O
      where (O.value as Quantity).value < 60
  )

define "HypoxemiaCriteriaMet":
  "SpO2LowOnRoomAir" or "PaO2LowOnRoomAir"

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 5 — ICU MAJOR CRITERIA
// ════════════════════════════════════════════════════════════════════════════════

// ── 5a. Invasive Mechanical Ventilation ──────────────────────────────────────

define "Mechanical Ventilation Procedure Codes":
  { '40617009', '57485005', '243147009', '182687005' }

define "RequiresInvasiveMechanicalVentilation":
  exists (
    [Procedure] P
      where P.status in { 'in-progress', 'completed' }
        and exists (
          P.code.coding c
            where c.system = 'http://snomed.info/sct'
              and c.code in "Mechanical Ventilation Procedure Codes"
        )
        and P.performed is not null
        and start of (P.performed as Period) >= (Now() - 24 hours)
  )
  or
  exists (
    [Observation] O
      where O.status in { 'final', 'amended', 'corrected' }
        and exists (
          O.code.coding c
            where c.system = 'http://snomed.info/sct'
              and c.code in "Mechanical Ventilation Procedure Codes"
        )
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
  )

// ── 5b. Septic Shock with Vasopressors ───────────────────────────────────────

define "Vasopressor Medication Codes":
  { '35455006', '66635000', '372686000', '10312003', '77916000' }

define "SepticShockWithVasopressors":
  exists (
    [Procedure] P
      where P.status in { 'in-progress', 'completed' }
        and exists (
          P.code.coding c
            where c.system = 'http://snomed.info/sct'
              and c.code in "Vasopressor Medication Codes"
        )
        and P.performed is not null
        and start of (P.performed as Period) >= (Now() - 24 hours)
  )
  or
  exists (
    [MedicationAdministration] MA
      where MA.status in { 'in-progress', 'completed' }
        and exists (
          (MA.medication as CodeableConcept).coding c
            where c.system = 'http://snomed.info/sct'
              and c.code in "Vasopressor Medication Codes"
        )
        and MA.effective is not null
        and (MA.effective as dateTime) >= (Now() - 24 hours)
  )

define "ICUMajorCriteriaMet":
  "RequiresInvasiveMechanicalVentilation" or "SepticShockWithVasopressors"

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 6 — ICU MINOR CRITERIA COMPONENTS
// ════════════════════════════════════════════════════════════════════════════════

// ── 6a. PaO2/FiO2 Ratio ≤250 ─────────────────────────────────────────────────

define "Recent PF Ratio Observations":
  [Observation: "PaO2 FiO2 ratio"] O