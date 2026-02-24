library CHF_InpatientAdmission_v1 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "ICD10PCS": 'http://www.cms.gov/Medicare/Coding/ICD10'

// ── Heart Failure ICD-10-CM codes ──────────────────────────────────────────
code "HF Unspecified": 'I50.9' from "ICD10CM"
code "HF Left Ventricular": 'I50.1' from "ICD10CM"
code "Systolic HF Unspecified": 'I50.20' from "ICD10CM"
code "Acute Systolic HF": 'I50.21' from "ICD10CM"
code "Chronic Systolic HF": 'I50.22' from "ICD10CM"
code "Acute on Chronic Systolic HF": 'I50.23' from "ICD10CM"
code "Diastolic HF Unspecified": 'I50.30' from "ICD10CM"
code "Acute Diastolic HF": 'I50.31' from "ICD10CM"
code "Chronic Diastolic HF": 'I50.32' from "ICD10CM"
code "Acute on Chronic Diastolic HF": 'I50.33' from "ICD10CM"
code "Combined Systolic Diastolic HF Unspecified": 'I50.40' from "ICD10CM"
code "Acute Combined Systolic Diastolic HF": 'I50.41' from "ICD10CM"
code "Chronic Combined Systolic Diastolic HF": 'I50.42' from "ICD10CM"
code "Acute on Chronic Combined Systolic Diastolic HF": 'I50.43' from "ICD10CM"
code "Right HF Due to Left HF": 'I50.810' from "ICD10CM"
code "Right HF Unspecified": 'I50.811' from "ICD10CM"
code "Acute Right HF": 'I50.812' from "ICD10CM"
code "Chronic Right HF": 'I50.813' from "ICD10CM"
code "Acute on Chronic Right HF": 'I50.814' from "ICD10CM"
code "End Stage HF": 'I50.84' from "ICD10CM"
code "Other HF": 'I50.89' from "ICD10CM"

// ── Vital sign LOINC codes ─────────────────────────────────────────────────
code "Systolic Blood Pressure": '8480-6' from "LOINC"
code "Heart Rate": '8867-4' from "LOINC"
code "Oxygen Saturation Pulse Ox": '59408-5' from "LOINC"
code "Respiratory Rate": '9279-1' from "LOINC"

// ── Lab LOINC codes ────────────────────────────────────────────────────────
code "Creatinine Serum": '2160-0' from "LOINC"
code "Potassium Serum": '2823-3' from "LOINC"
code "Sodium Serum": '2951-2' from "LOINC"
code "Troponin hs": '89579-7' from "LOINC"
code "BNP": '42637-9' from "LOINC"
code "NT-proBNP": '33762-6' from "LOINC"
code "Body Weight": '29463-7' from "LOINC"
code "Urine Output": '9192-6' from "LOINC"

// ── NIV / Respiratory support ICD-10-PCS codes ────────────────────────────
code "NIV 5A09357": '5A09357' from "ICD10PCS"
code "NIV 5A09457": '5A09457' from "ICD10PCS"
code "NIV 5A0935Z": '5A0935Z' from "ICD10PCS"
code "NIV 5A0945Z": '5A0945Z' from "ICD10PCS"

// ── Valueset (canonical) ───────────────────────────────────────────────────
valueset "Heart Failure Diagnoses": 'http://lucidreview.dev/ValueSet/heart-failure-diagnoses'

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

context Patient

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — DIAGNOSIS
// ═══════════════════════════════════════════════════════════════════════════

define "HeartFailureDiagnosisCodes":
  {
    'I50.9', 'I50.1',
    'I50.20', 'I50.21', 'I50.22', 'I50.23',
    'I50.30', 'I50.31', 'I50.32', 'I50.33',
    'I50.40', 'I50.41', 'I50.42', 'I50.43',
    'I50.810', 'I50.811', 'I50.812', 'I50.813', 'I50.814',
    'I50.84', 'I50.89'
  }

define "HeartFailureDiagnosis":
  exists (
    [Condition] C
      where (
        C.code.coding.exists(coding => coding.code in "HeartFailureDiagnosisCodes")
      )
        and C.clinicalStatus.coding.exists(s =>
          s.code in { 'active', 'recurrence', 'relapse' }
        )
  )

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — HEMODYNAMIC COMPROMISE
// ═══════════════════════════════════════════════════════════════════════════

// ── 2a. Systolic BP < 90 mmHg ─────────────────────────────────────────────

define "RecentSBPObservations":
  [Observation: "Systolic Blood Pressure"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "SystolicBPLessThan90":
  exists (
    "RecentSBPObservations" O
      where (O.value as Quantity).value < 90
  )

// ── 2b. Persistent tachycardia > 100 bpm ──────────────────────────────────

define "RecentHRObservations":
  [Observation: "Heart Rate"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "PersistentTachycardiaUnresponsive":
  exists (
    "RecentHRObservations" O
      where (O.value as Quantity).value > 100
  )

// ── 2c. Clinical signs of hypoperfusion (from clinical notes / observations)

define "CoolExtremitiesDocumented":
  exists (
    [Observation] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
        and O.code.text in {
          'cool extremities', 'mottled extremities', 'cold extremities',
          'cool and mottled extremities', 'poor perfusion extremities',
          'clammy extremities'
        }
  )
    or exists (
      [Condition] C
        where C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
          and C.code.text in {
            'cool extremities', 'mottled extremities', 'cold extremities',
            'clammy skin', 'peripheral hypoperfusion'
          }
    )

define "AlteredMentationHypoperfusion":
  exists (
    [Observation] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
        and O.code.text in {
          'altered mental status', 'altered mentation',
          'confusion due to hypoperfusion', 'acute confusion low output',
          'decreased responsiveness hypoperfusion', 'encephalopathy low cardiac output'
        }
  )
    or exists (
      [Condition] C
        where C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
          and C.code.text in {
            'altered mental status due to hypoperfusion',
            'hypoperfusion encephalopathy',
            'cardiogenic encephalopathy'
          }
    )

define "RecentUrineOutputObservations":
  [Observation: "Urine Output"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "OliguriaPresent":
  exists (
    "RecentUrineOutputObservations" O
      where (O.value as Quantity).value < 0.5
        and (O.value as Quantity).unit in { 'mL/kg/hr', 'mL/kg/h' }
  )
    or exists (
      [Observation] O
        where O.status in { 'final', 'amended', 'corrected' }
          and O.effective is not null
          and (O.effective as dateTime) >= (Now() - 24 hours)
          and O.code.text in { 'oliguria', 'low urine output', 'decreased urine output' }
    )

define "HypoperfusionSignsPresent":
  "CoolExtremitiesDocumented"
    or "AlteredMentationHypoperfusion"
    or "OliguriaPresent"

define "HemodynamicCompromiseMet":
  "SystolicBPLessThan90"
    or "PersistentTachycardiaUnresponsive"
    or "HypoperfusionSignsPresent"

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — SEVERE RESPIRATORY DISTRESS
// ═══════════════════════════════════════════════════════════════════════════

// ── 3a. SpO2 < 90% on room air ────────────────────────────────────────────

define "RecentSpO2Observations":
  [Observation: "Oxygen Saturation Pulse Ox"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "SpO2LessThan90OnRoomAir":
  exists (
    "RecentSpO2Observations" O
      where (O.value as Quantity).value < 90
        and (
          O.component.exists(c =>
            c.code.text in { 'room air', 'on room air', 'supplemental oxygen', 'O2 delivery' }
              and c.value.text in { 'room air', 'RA', 'none' }
          )
          or not O.component.exists(c =>
            c.code.text in { 'supplemental oxygen', 'O2 delivery', 'inhaled oxygen flow rate' }
          )
        )
  )

// ── 3b. Respiratory Rate > 25 breaths/min ─────────────────────────────────

define "RecentRRObservations":
  [Observation: "Respiratory Rate"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "RespiratoryRateGreaterThan25":
  exists (
    "RecentRRObservations" O
      where (O.value as Quantity).value > 25
  )

// ── 3c. Supplemental O2 > 4 L/min ────────────────────────────────────────

define "SupplementalO2GreaterThan4LPM":
  exists (
    [Observation] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
        and O.code.text in {
          'supplemental oxygen flow rate', 'inhaled oxygen flow rate',
          'oxygen flow rate', 'O2 flow rate', 'nasal cannula flow rate'
        }
        and (O.value as Quantity).value > 4
        and (O.value as Quantity).unit in { 'L/min', 'L/m' }
  )

// ── 3d. Non-invasive ventilation initiated ────────────────────────────────

define "NIVProcedureCodes":
  { '5A09357', '5A09457', '5A0935Z', '5A0945Z' }

define "NonInvasiveVentilationInitiated":
  exists (
    [Procedure] P
      where P.status in { 'in-progress', 'completed' }
        and P.performed is not null
        and (
          (P.performed as dateTime) >= (Now() - 24 hours)
          or (start of (P.performed as Period)) >= (Now() - 24 hours)
        )
        and P.code.coding.exists(c => c.code in "NIVProcedureCodes")
  )
    or exists (
      [Observation] O
        where O.status in { 'final', 'amended', 'corrected' }
          and O.effective is not null
          and (O.effective as dateTime) >= (Now() - 24 hours)
          and O.code.text in {
            'CPAP', 'BiPAP', 'non-invasive ventilation', 'NIV',
            'CPAP initiated', 'BiPAP initiated', 'high flow nasal cannula',
            'HFNC', 'non-invasive positive pressure ventilation', 'NIPPV'
          }
    )

define "SevereRespiratoryDistressMet":
  "SpO2LessThan90OnRoomAir"
    or "RespiratoryRateGreaterThan25"
    or "SupplementalO2GreaterThan4LPM"
    or "NonInvasiveVentilationInitiated"

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — WORSENING RENAL FUNCTION (CARDIORENAL SYNDROME)
// ═══════════════════════════════════════════════════════════════════════════

define "MostRecentCre