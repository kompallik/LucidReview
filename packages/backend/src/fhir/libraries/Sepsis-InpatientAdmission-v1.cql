library Sepsis_InpatientAdmission_v1 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'
codesystem "RxNorm": 'http://www.nlm.nih.gov/research/umls/rxnorm'

valueset "Sepsis and Septic Shock Diagnoses": 'http://lucidreview.dev/ValueSet/sepsis-septic-shock'
valueset "Vasopressor Medications": 'http://lucidreview.dev/ValueSet/vasopressor-medications'
valueset "Broad Spectrum IV Antibiotics": 'http://lucidreview.dev/ValueSet/broad-spectrum-iv-antibiotics'
valueset "Blood Culture Procedures": 'http://lucidreview.dev/ValueSet/blood-culture-procedures'
valueset "IV Crystalloid Fluids": 'http://lucidreview.dev/ValueSet/iv-crystalloid-fluids'

code "Sepsis unspecified organism": 'A41.9' from "ICD10CM"
code "Sepsis due to MSSA": 'A41.01' from "ICD10CM"
code "Sepsis due to MRSA": 'A41.02' from "ICD10CM"
code "Sepsis due to other specified staphylococcus": 'A41.1' from "ICD10CM"
code "Sepsis due to Streptococcus pneumoniae": 'A41.2' from "ICD10CM"
code "Sepsis due to Haemophilus influenzae": 'A41.3' from "ICD10CM"
code "Sepsis due to unspecified gram-negative organisms": 'A41.50' from "ICD10CM"
code "Sepsis due to Streptococcus group A": 'A40.0' from "ICD10CM"
code "Sepsis due to Streptococcus group B": 'A40.1' from "ICD10CM"
code "Streptococcal sepsis unspecified": 'A40.9' from "ICD10CM"
code "Severe sepsis without septic shock": 'R65.20' from "ICD10CM"
code "Severe sepsis with septic shock": 'R65.21' from "ICD10CM"

code "Glasgow coma score total": '35088-4' from "LOINC"
code "Respiratory rate": '9279-1' from "LOINC"
code "Systolic blood pressure": '8480-6' from "LOINC"
code "Mean arterial pressure": '8478-0' from "LOINC"
code "Lactate [Moles/volume] in Blood": '2524-7' from "LOINC"
code "Creatinine [Mass/volume] in Serum or Plasma": '2160-0' from "LOINC"
code "Bilirubin.total [Mass/volume] in Serum or Plasma": '1975-2' from "LOINC"
code "Platelets [#/volume] in Blood by Automated count": '777-3' from "LOINC"
code "INR in Platelet poor plasma by Coagulation assay": '6301-6' from "LOINC"
code "aPTT in Platelet poor plasma by Coagulation assay": '3173-2' from "LOINC"
code "Oxygen [Partial pressure] in Arterial blood": '2703-7' from "LOINC"
code "PaO2/FiO2 [Ratio]": '50984-4' from "LOINC"
code "Urine output [Volume] total": '9192-6' from "LOINC"
code "SOFA total score": '96790-9' from "LOINC"
code "Oxygen saturation in Arterial blood": '2708-6' from "LOINC"
code "Norepinephrine [SNOMED]": '45555007' from "SNOMEDCT"
code "Vasopressin [SNOMED]": '27989007' from "SNOMEDCT"
code "Epinephrine [SNOMED]": '387362001' from "SNOMEDCT"
code "Dopamine [SNOMED]": '412383006' from "SNOMEDCT"
code "Phenylephrine [SNOMED]": '372771005' from "SNOMEDCT"

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

parameter "Sepsis Recognition Time" DateTime
  default Now()

context Patient

// ============================================================
// HELPER: Observation retrieval utilities
// ============================================================

define "Lookback 24 Hours":
  Interval[Now() - 24 hours, Now()]

define "Lookback 6 Hours":
  Interval[Now() - 6 hours, Now()]

define "Lookback 48 Hours":
  Interval[Now() - 48 hours, Now()]

define "Lookback 30 Days":
  Interval[Now() - 30 days, Now()]

define function MostRecentObservationValue(observations List<Observation>):
  Last(
    observations O
      sort by (effective as dateTime)
  )

// ============================================================
// LEAF: HasSepsisDiagnosisCode
// Sepsis or Septic Shock ICD-10 Diagnosis Code present
// ============================================================

define "Sepsis ICD10 Code List":
  { 'A41.9', 'A41.01', 'A41.02', 'A41.1', 'A41.2', 'A41.3',
    'A41.50', 'A40.0', 'A40.1', 'A40.9', 'R65.20', 'R65.21' }

define "HasSepsisDiagnosisCode":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.code in "Sepsis ICD10 Code List")
        and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
        and (
          C.onset is not null
          or C.recordedDate is not null
        )
  )

// ============================================================
// LEAF: SOFAScoreAtLeastTwo
// SOFA Score >= 2 from documented observation or clinical note
// ============================================================

define "SOFA Score Observations":
  [Observation: "SOFA total score"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) in "Lookback 24 Hours"

define "SOFAScoreAtLeastTwo":
  exists (
    "SOFA Score Observations" O
      where (O.value as Quantity).value >= 2
  )

// ============================================================
// LEAF: GCSLessThan15
// Altered Mentation (GCS <15) — qSOFA component
// ============================================================

define "GCS Observations Recent":
  [Observation: "Glasgow coma score total"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) in "Lookback 6 Hours"

define "GCSLessThan15":
  exists (
    "GCS Observations Recent" O
      where (O.value as Quantity).value < 15
  )

// ============================================================
// LEAF: RespiratoryRateAtLeast22
// Respiratory Rate >= 22 breaths/min — qSOFA component
// ============================================================

define "Respiratory Rate Observations Recent":
  [Observation: "Respiratory rate"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) in "Lookback 6 Hours"

define "RespiratoryRateAtLeast22":
  exists (
    "Respiratory Rate Observations Recent" O
      where (O.value as Quantity).value >= 22
  )

// ============================================================
// LEAF: SBPAtMost100
// Systolic Blood Pressure <= 100 mmHg — qSOFA component
// ============================================================

define "SBP Observations Recent":
  [Observation: "Systolic blood pressure"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) in "Lookback 6 Hours"

define "SBPAtMost100":
  exists (
    "SBP Observations Recent" O
      where (O.value as Quantity).value <= 100
  )

// ============================================================
// COMPOSITE: QSOFAScoreAtLeastTwo
// At least 2 of 3 qSOFA sub-criteria present simultaneously
// ============================================================

define "qSOFA Component Count":
  (if "GCSLessThan15" then 1 else 0)
  + (if "RespiratoryRateAtLeast22" then 1 else 0)
  + (if "SBPAtMost100" then 1 else 0)

define "QSOFAScoreAtLeastTwo":
  "qSOFA Component Count" >= 2

// ============================================================
// LEAF: VasopressorRequiredForMAP
// Vasopressor Required to Maintain MAP >= 65 mmHg
// ============================================================

define "Active Vasopressor MedicationAdministrations":
  [MedicationAdministration] MA
    where MA.status in { 'in-progress', 'completed' }
      and (
        MA.medication.coding.exists(c => c.system = 'http://snomed.info/sct'
          and c.code in { '45555007', '27989007', '387362001', '412383006', '372771005' })
        or MA.medication.coding.exists(c => c.system = 'http://www.nlm.nih.gov/research/umls/rxnorm')
      )
      and MA.effective is not null
      and (
        (MA.effective as dateTime) in "Lookback 24 Hours"
        or (
          (MA.effective as Period).start is not null
          and (MA.effective as Period).start in "Lookback 24 Hours"
        )
      )

define "MAP Observations Recent":
  [Observation: "Mean arterial pressure"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) in "Lookback 6 Hours"

define "MAP At Or Above 65 With Vasopressor":
  exists (
    "MAP Observations Recent" O
      where (O.value as Quantity).value >= 65
  )
  and exists "Active Vasopressor MedicationAdministrations"

define "VasopressorRequiredForMAP":
  exists "Active Vasopressor MedicationAdministrations"
  and "MAP At Or Above 65 With Vasopressor"

// ============================================================
// LEAF: LactateGreaterThan2PostFluid
// Serum Lactate > 2 mmol/L Despite Fluid Resuscitation
// ============================================================

define "Lactate Observations 24 Hours":
  [Observation: "Lactate [Moles/volume] in Blood"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) in "Lookback 24 Hours"

define "Recent IV Fluid Administrations":
  [MedicationAdministration] MA
    where MA.status in { 'completed', 'in-progress' }
      and MA.effective is not null
      and (
        (MA.effective as dateTime) in "Lookback 6 Hours"
        or (
          (MA.effective as Period).start is not null
          and (MA.effective as Period).start in "Lookback 6 Hours"
        )
      )
      and MA.medication.coding.exists(c =>
        c.display ~ 'Normal Saline'
        or c.display ~ 'Lactated Ringer'
        or c.display ~ 'sodium chloride 0.9%'
        or c.display ~ 'crystalloid'
      )

define "LactateGreaterThan2PostFluid":
  exists (
    "Lactate Observations 24 Hours" O
      where (O.value as Quantity).value > 2
  )
  and exists "Recent IV Fluid Administrations"

// ============================================================
// LEAF: CreatinineGreaterThan1Point2
// Acute Kidney Injury — Creatinine > 1.2 mg/dL
// ============================================================

define "Creatinine Observations 24 Hours":
  [Observation: "Creatinine [Mass/volume] in Serum or Plasma"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) in "Lookback 24 Hours"

define "CreatinineGreaterThan1Point2":
  exists (
    "Creatinine Observations 24 Hours" O
      where (O.value as Quantity).value > 1.2
  )

// ============================================================
// LEAF: UrinOutputLessThanPointFiveFor2Hours
// Urine Output < 0.5 mL/kg/hr for >= 2 consecutive hours
// ============================================================

define "Patient Weight in kg":
  Last(
    [Observation: code ~ 'http://loinc.org|29463-7'] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.effective is not null
      sort by (effective as dateTime)
  ).value as Quantity

define "Urine Output Observations 6 Hours":
  [Observation: "Urine output [Volume] total"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) in "Lookback 6 Hours"
    sort by (effective as dateTime)

define "Urine Output Rate mL per kg per hr":
  if "Patient Weight in kg" is not null and "Patient Weight in kg".value > 0
    and exists "Urine Output Observations 6 Hours"
  then
    Avg(
      "Urine Output Observations 6 Hours" O
        return (O.value as Quantity).value / "Patient Weight in kg".value
    )
  else null

define "UrinOutputLessThanPointFiveFor2Hours":
  Count("Urine Output Observations 6 Hours") >= 2
  and "Urine Output Rate mL per kg per hr" is not null
  and "Urine Output Rate mL per kg per hr" < 0.5

// ============================================================
// LEAF: BilirubinGreaterThan1Point2
// Hepatic Dysfunction — Total Bilirubin > 1.2 mg/dL
// ============================================================

define "Bilirubin Observations 24 Hours":
  [Observation: "Bilirubin.total [Mass/volume] in Serum or Plasma"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O