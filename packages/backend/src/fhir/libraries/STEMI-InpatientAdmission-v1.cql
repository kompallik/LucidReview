library STEMI_InpatientAdmission_v1 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'

valueset "ACS Diagnosis Codes": 'http://lucidreview.dev/ValueSet/acs-diagnosis-codes'

code "AMI unspecified": 'I21.9' from "ICD10CM"
code "AMI anterior wall STEMI": 'I21.01' from "ICD10CM"
code "AMI inferior wall STEMI": 'I21.02' from "ICD10CM"
code "AMI other site STEMI": 'I21.09' from "ICD10CM"
code "AMI inferior STEMI subsequent": 'I21.11' from "ICD10CM"
code "AMI other STEMI subsequent site": 'I21.19' from "ICD10CM"
code "STEMI unspecified site": 'I21.3' from "ICD10CM"
code "NSTEMI": 'I21.4' from "ICD10CM"
code "Subsequent STEMI anterior": 'I22.0' from "ICD10CM"
code "Subsequent STEMI inferior": 'I22.1' from "ICD10CM"
code "Subsequent STEMI other site": 'I22.8' from "ICD10CM"
code "Subsequent STEMI unspecified": 'I22.9' from "ICD10CM"
code "Unstable angina": 'I20.0' from "ICD10CM"

code "Systolic blood pressure": '8480-6' from "LOINC"
code "Heart rate": '8867-4' from "LOINC"
code "ECG findings": '8625-6' from "LOINC"
code "Troponin I high sensitivity": '89579-7' from "LOINC"
code "Troponin I": '10839-9' from "LOINC"
code "Troponin T": '6598-7' from "LOINC"

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

context Patient

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: ELIGIBLE ACS DIAGNOSIS
// ─────────────────────────────────────────────────────────────────────────────

define "ACS Diagnosis Code List":
  { 'I21.9', 'I21.01', 'I21.02', 'I21.09', 'I21.11', 'I21.19',
    'I21.3', 'I21.4', 'I22.0', 'I22.1', 'I22.8', 'I22.9', 'I20.0' }

define "HasEligibleACSDiagnosis":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.code.value in "ACS Diagnosis Code List")
        and C.clinicalStatus.coding.exists(coding =>
          coding.code.value in { 'active', 'recurrence', 'relapse' })
        and (
          C.recordedDate is not null
            and (C.recordedDate as dateTime) >= (Now() - 72 hours)
          or C.onset is not null
            and (C.onset as dateTime) >= (Now() - 72 hours)
        )
  )

define "DiagnosisMet":
  "HasEligibleACSDiagnosis"

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: NO SAFE DISCHARGE FROM ED — CONTRAINDICATIONS
// ─────────────────────────────────────────────────────────────────────────────

// 2a. Ongoing Chest Pain or Ischemic Symptoms
define "OngoingChestPainPresent":
  exists (
    [Observation] O
      where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
        and O.code.coding.exists(coding =>
          coding.system.value = 'http://snomed.info/sct'
            and coding.code.value in {
              '29857009',   // Chest pain
              '371791000',  // Chest pain at rest
              '57676002',   // Joint pain (anginal equivalent — mapped broadly)
              '13213009'    // Congestive heart failure (anginal equivalent context)
            }
          or coding.system.value = 'http://loinc.org'
            and coding.code.value = '75325-1'  // Pain severity/presence
        )
        and O.value is not null
        and (O.value as CodeableConcept).coding.exists(c =>
          c.code.value in { 'present', 'positive', 'LA9633-4', 'LA46-8' })
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
  )
    or exists (
      [Observation] O
        where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
          and O.code.text.value ~ 'chest pain'
          and O.effective is not null
          and (O.effective as dateTime) >= (Now() - 24 hours)
    )

// 2b-i. Systolic BP < 90 mmHg
define "Recent Systolic BP Observations":
  [Observation: "Systolic blood pressure"] O
    where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "SystolicBPLessThan90":
  exists (
    "Recent Systolic BP Observations" O
      where (O.value as Quantity).value < 90
  )
    or exists (
      [Observation] O
        where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
          and O.code.coding.exists(c => c.code.value = '8480-6')
          and O.effective is not null
          and (O.effective as dateTime) >= (Now() - 6 hours)
          and (O.value as Quantity).value < 90
    )
    or exists (
      [Observation] O
        where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
          and O.code.coding.exists(c => c.code.value = '85354-9')  // BP panel
          and O.component.exists(comp =>
            comp.code.coding.exists(c => c.code.value = '8480-6')
              and (comp.value as Quantity).value < 90)
          and O.effective is not null
          and (O.effective as dateTime) >= (Now() - 6 hours)
    )

// 2b-ii. Heart Rate > 100 bpm with Hemodynamic Compromise
define "Recent Heart Rate Observations":
  [Observation: "Heart rate"] O
    where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "TachycardiaWithHemodynamicCompromise":
  exists (
    "Recent Heart Rate Observations" O
      where (O.value as Quantity).value > 100
  )
    and (
      "SystolicBPLessThan90"
        or "CardiogenicShockSignsPresent"
    )

// 2b-iii. Cardiogenic Shock Signs (Clinical Note / Observation)
define "CardiogenicShockSignsPresent":
  exists (
    [Observation] O
      where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
        and (
          O.code.coding.exists(c =>
            c.system.value = 'http://snomed.info/sct'
              and c.code.value in {
                '39266001',   // Cardiogenic shock
                '36955009',   // Shock
                '44077006'    // Shock, low-output
              })
          or O.code.text.value ~ 'cardiogenic shock'
          or O.code.text.value ~ 'Killip IV'
        )
        and O.value is not null
        and (O.value as CodeableConcept).coding.exists(c =>
          c.code.value in { 'present', 'positive', 'LA9633-4' })
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
  )
    or exists (
      [Condition] C
        where C.code.coding.exists(c =>
          c.system.value = 'http://snomed.info/sct'
            and c.code.value in { '39266001', '36955009' }
          or c.system.value = 'http://hl7.org/fhir/sid/icd-10-cm'
            and c.code.value = 'R57.0')
          and C.clinicalStatus.coding.exists(c =>
            c.code.value in { 'active', 'recurrence', 'relapse' })
    )

// 2b. Hemodynamic Instability (OR)
define "HemodynamicInstabilityPresent":
  "SystolicBPLessThan90"
    or "TachycardiaWithHemodynamicCompromise"
    or "CardiogenicShockSignsPresent"

// 2c. High-Risk ECG Findings
define "HighRiskECGFindingsPresent":
  exists (
    [Observation] O
      where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
        and (
          O.code.coding.exists(c =>
            c.code.value in { '8625-6', '11524-6', '34534-8' })
          or O.code.text.value ~ 'ECG'
          or O.code.text.value ~ 'electrocardiogram'
        )
        and (
          O.value is not null
            and (O.value as CodeableConcept).coding.exists(c =>
              c.code.value in { 'present', 'positive', 'abnormal' })
          or O.component.exists(comp =>
            comp.code.coding.exists(c =>
              c.code.value in { 'ST-elevation', 'LBBB', 'ST-depression' })
              and (comp.value as CodeableConcept).coding.exists(c =>
                c.code.value in { 'present', 'positive' }))
        )
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
  )

// 2. Combined No-Safe-Discharge Contraindications (AND)
define "NoSafeEDDischargeContraindicationsMet":
  "OngoingChestPainPresent"
    and "HemodynamicInstabilityPresent"
    and "HighRiskECGFindingsPresent"

define "EDContraindicationsMet":
  "NoSafeEDDischargeContraindicationsMet"

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: ACS TYPE-SPECIFIC CRITERIA
// ─────────────────────────────────────────────────────────────────────────────

// 3a. STEMI Pathway

define "STEMIPrecordialCriteriaMet":
  exists (
    [Observation] O
      where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
        and (
          O.code.coding.exists(c => c.code.value in { '8625-6', '11524-6', '34534-8' })
          or O.code.text.value ~ 'ECG'
          or O.code.text.value ~ 'ST elevation'
        )
        and (
          O.value is not null
            and (O.value as CodeableConcept).coding.exists(c =>
              c.code.value in { 'present', 'positive' })
          or O.component.exists(comp =>
            comp.code.coding.exists(c =>
              c.code.value = 'ST-elevation-precordial'
                or c.display.value ~ 'precordial')
              and (comp.value as Quantity).value >= 2)
          or O.note.exists(n =>
            n.text.value ~ 'ST elevation' and n.text.value ~ 'precordial')
        )
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
  )

define "STEMILimbCriteriaMet":
  exists (
    [Observation] O
      where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
        and (
          O.code.coding.exists(c => c.code.value in { '8625-6', '11524-6', '34534-8' })
          or O.code.text.value ~ 'ECG'
          or O.code.text.value ~ 'ST elevation'
        )
        and (
          O.component.exists(comp =>
            comp.code.coding.exists(c =>
              c.code.value = 'ST-elevation-limb'
                or c.display.value ~ 'limb lead')
              and (comp.value as Quantity).value >= 1)
          or O.note.exists(n =>
            n.text.value ~ 'ST elevation' and n.text.value ~ 'limb')
        )
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
  )

define "NewLBBBWithIschemicSymptoms":
  exists (
    [Observation] O
      where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
        and (
          O.code.coding.exists(c => c.code.value in { '8625-6', '11524-6', '34534-8' })
          or O.code.text.value ~ 'ECG'
          or O.code.text.value ~ 'LBBB'
          or O.code.text.value ~ 'bundle branch block'
        )
        and (
          O.value is not null
            and (O.value as CodeableConcept).coding.exists(c =>
              c.system.value = 'http://snomed.info/sct'
                and c.code.value in {
                  '54205005',  // Left bundle branch block
                  '233917008'  // New LBBB
                })
          or O.note.exists(n =>
            n.text.value ~ 'LBBB' or n.text.value ~ 'left bundle branch block')
        )
        and O.effective is not null
        and (O.effective as dateTime) >= (Now() - 24 hours)
  )
    and "OngoingChestPainPresent"

define "STEMIPathwayCriteriaMet":
  "STEM