library DKA_InpatientAdmission_v1 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'
codesystem "CPT": 'http://www.ama-assn.org/go/cpt'

// ── ICD-10 diagnosis codes ───────────────────────────────────────────────────
code "E11.10 T2DM with DKA without coma":         'E11.10'  from "ICD10CM"
code "E11.11 T2DM with DKA with coma":            'E11.11'  from "ICD10CM"
code "E10.10 T1DM with DKA without coma":         'E10.10'  from "ICD10CM"
code "E10.11 T1DM with DKA with coma":            'E10.11'  from "ICD10CM"
code "E11.00 T2DM with HHS without coma":         'E11.00'  from "ICD10CM"
code "E11.01 T2DM with HHS with coma":            'E11.01'  from "ICD10CM"
code "E11.641 T2DM with hypoglycemia with coma":  'E11.641' from "ICD10CM"
code "E10.641 T1DM with hypoglycemia with coma":  'E10.641' from "ICD10CM"
code "E10.649 T1DM with hypoglycemia without coma":'E10.649' from "ICD10CM"
code "E13.10 Other DM with DKA without coma":     'E13.10'  from "ICD10CM"
code "E13.11 Other DM with DKA with coma":        'E13.11'  from "ICD10CM"
code "E13.00 Other DM with HHS without coma":     'E13.00'  from "ICD10CM"
code "E13.01 Other DM with HHS with coma":        'E13.01'  from "ICD10CM"

// ── LOINC lab codes ──────────────────────────────────────────────────────────
code "Glucose Serum LOINC":           '2345-7'   from "LOINC"
code "Bicarbonate Serum LOINC":       '1963-8'   from "LOINC"
code "pH Venous LOINC":               '2746-6'   from "LOINC"
code "pH Arterial LOINC":             '2744-1'   from "LOINC"
code "BHB Serum LOINC":               '53061-8'  from "LOINC"
code "Urine Ketones LOINC":           '2514-8'   from "LOINC"
code "Osmolality Serum LOINC":        '2692-2'   from "LOINC"
code "Potassium Serum LOINC":         '2823-3'   from "LOINC"
code "Anion Gap Serum LOINC":         '33037-3'  from "LOINC"
code "BUN LOINC":                     '3094-0'   from "LOINC"
code "Creatinine LOINC":              '2160-0'   from "LOINC"
code "GCS Total LOINC":               '9269-2'   from "LOINC"

// ── CPT procedure codes ──────────────────────────────────────────────────────
code "IV Infusion CPT":               '96365'    from "CPT"

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

context Patient

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — QUALIFYING DIAGNOSIS
// ════════════════════════════════════════════════════════════════════════════

define "QualifyingDiagnosisCodes":
  {
    'E11.10', 'E11.11', 'E10.10', 'E10.11',
    'E11.00', 'E11.01', 'E11.641', 'E10.641', 'E10.649',
    'E13.10', 'E13.11', 'E13.00', 'E13.01'
  }

define "HasQualifyingDiabetesDiagnosis":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.code in "QualifyingDiagnosisCodes")
        and C.clinicalStatus.coding.exists(coding => coding.code in { 'active', 'recurrence', 'relapse' })
  )

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — DKA DIAGNOSTIC CRITERIA
// ════════════════════════════════════════════════════════════════════════════

// ── 2a. DKA Glucose ─────────────────────────────────────────────────────────

define "RecentGlucoseObservations":
  [Observation: "Glucose Serum LOINC"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "DKAGlucoseCriteriaMet":
  exists (
    "RecentGlucoseObservations" O
      where (O.value as Quantity).value > 250
  )

// ── 2b. DKA Bicarbonate ─────────────────────────────────────────────────────

define "RecentBicarbonateObservations":
  [Observation: "Bicarbonate Serum LOINC"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "DKABicarbonateLow":
  exists (
    "RecentBicarbonateObservations" O
      where (O.value as Quantity).value < 18
  )

// ── 2c. DKA pH ──────────────────────────────────────────────────────────────

define "RecentVenousPHObservations":
  [Observation: "pH Venous LOINC"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "RecentArterialPHObservations":
  [Observation: "pH Arterial LOINC"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "RecentAllPHObservations":
  "RecentVenousPHObservations" union "RecentArterialPHObservations"

define "DKApHLow":
  exists (
    "RecentAllPHObservations" O
      where (O.value as Quantity).value < 7.3
  )

// ── 2d. DKA Acidosis (Bicarb OR pH) ─────────────────────────────────────────

define "DKAAcidosisCriteriaMet":
  "DKABicarbonateLow" or "DKApHLow"

// ── 2e. Serum BHB ───────────────────────────────────────────────────────────

define "RecentBHBObservations":
  [Observation: "BHB Serum LOINC"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "SerumBHBElevated":
  exists (
    "RecentBHBObservations" O
      where (O.value as Quantity).value > 3
  )

// ── 2f. Urine Ketones ───────────────────────────────────────────────────────

define "UrineKetonesPositiveValues":
  { '2+', '3+', 'large', 'positive', 'moderate' }

define "RecentUrineKetoneObservations":
  [Observation: "Urine Ketones LOINC"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "UrineKetonesPositive":
  exists (
    "RecentUrineKetoneObservations" O
      where (O.value as CodeableConcept).coding.exists(
        coding => coding.code in "UrineKetonesPositiveValues"
              or Lower(coding.display) in "UrineKetonesPositiveValues"
      )
      or exists (
        "RecentUrineKetoneObservations" O2
          where Lower((O2.value as string)) in "UrineKetonesPositiveValues"
      )
  )

// ── 2g. DKA Ketones (Serum OR Urine) ────────────────────────────────────────

define "DKAKetonesCriteriaMet":
  "SerumBHBElevated" or "UrineKetonesPositive"

// ── 2h. Full DKA Criteria (All Three) ───────────────────────────────────────

define "MeetsDKADiagnosticCriteria":
  "DKAGlucoseCriteriaMet"
    and "DKAAcidosisCriteriaMet"
    and "DKAKetonesCriteriaMet"

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — HHS DIAGNOSTIC CRITERIA
// ════════════════════════════════════════════════════════════════════════════

// ── 3a. HHS Glucose ─────────────────────────────────────────────────────────

define "HHSGlucoseCriteriaMet":
  exists (
    "RecentGlucoseObservations" O
      where (O.value as Quantity).value > 600
  )

// ── 3b. HHS Osmolality ──────────────────────────────────────────────────────

define "RecentOsmolalityObservations":
  [Observation: "Osmolality Serum LOINC"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "HHSOsmolalityCriteriaMet":
  exists (
    "RecentOsmolalityObservations" O
      where (O.value as Quantity).value > 320
  )

// ── 3c. Profound Dehydration ────────────────────────────────────────────────

define "RecentBUNObservations":
  [Observation: "BUN LOINC"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "RecentCreatinineObservations":
  [Observation: "Creatinine LOINC"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "BUNCrRatioElevated":
  exists (
    "RecentBUNObservations" BUN
      where exists (
        "RecentCreatinineObservations" Cr
          where Cr.value is not null
            and BUN.value is not null
            and (Cr.value as Quantity).value > 0
            and ((BUN.value as Quantity).value / (Cr.value as Quantity).value) > 20
      )
  )

define "DehydrationTerms":
  {
    'dehydration', 'severe dehydration', 'profound dehydration',
    'poor skin turgor', 'dry mucous membranes', 'volume depletion',
    'hypovolemia', 'tachycardia', 'hypotension'
  }

define "DehydrationDocumentedInNotes":
  exists (
    [Condition] C
      where C.code.coding.exists(
        coding => coding.system = 'http://snomed.info/sct'
          and coding.code in { '34095006', '276883002', '44262008' }
      )
      and C.clinicalStatus.coding.exists(coding => coding.code in { 'active', 'recurrence', 'relapse' })
  )

define "ProfoundDehydrationDocumented":
  "BUNCrRatioElevated"
    or "DehydrationDocumentedInNotes"

// ── 3d. Altered Consciousness ───────────────────────────────────────────────

define "AlteredConsciousnessTermCodes":
  { '40917007', '130987000', '271782001', '405535000', '419284004', '192971006' }

define "AlteredConsciousnessFromCondition":
  exists (
    [Condition] C
      where C.code.coding.exists(
        coding => coding.system = 'http://snomed.info/sct'
          and coding.code in "AlteredConsciousnessTermCodes"
      )
      and C.clinicalStatus.coding.exists(coding => coding.code in { 'active', 'recurrence', 'relapse' })
  )

define "RecentGCSObservations":
  [Observation: "GCS Total LOINC"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "GCSBelow14":
  exists (
    "RecentGCSObservations" O
      where (O.value as Quantity).value < 14
  )

define "AlteredConsciousnessDocumented":
  "AlteredConsciousnessFromCondition" or "GCSBelow14"

// ── 3e. HHS Clinical Features (Dehydration OR AMS) ──────────────────────────

define "HHSClinicalFeaturesMet":
  "ProfoundDehydrationDocumented" or "AlteredConsciousnessDocumented"

// ── 3f. Full HHS Criteria (All Three) ───────────────────────────────────────

define "MeetsHHSDiagnosticCriteria":
  "HHSGlucoseCriteriaMet"
    and "HHSOsmolalityCriteriaMet"
    and "HHSClinical