library UM_InpatientAdmission_AcuteRespFailure version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'

valueset "Acute Respiratory Failure Diagnoses": 'http://lucidreview.dev/ValueSet/acute-respiratory-failure'

code "Acute respiratory failure, unspecified": 'J96.00' from "ICD10CM"
code "Acute respiratory failure with hypoxia": 'J96.01' from "ICD10CM"
code "Acute respiratory failure with hypercapnia": 'J96.02' from "ICD10CM"
code "SpO2 by pulse ox": '59408-5' from "LOINC"
code "Arterial pO2": '2703-7' from "LOINC"

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

context Patient

define "Acute Respiratory Failure Condition Codes":
  { "Acute respiratory failure, unspecified",
    "Acute respiratory failure with hypoxia",
    "Acute respiratory failure with hypercapnia" }

define "Has Acute Respiratory Failure Diagnosis":
  exists (
    [Condition] C
      where C.code.coding.code in { 'J96.00', 'J96.01', 'J96.02' }
        and C.clinicalStatus.coding.code in { 'active', 'recurrence', 'relapse' }
  )

define "Recent SpO2 Observations":
  [Observation: "SpO2 by pulse ox"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "Has Low SpO2 Within 6 Hours":
  exists (
    "Recent SpO2 Observations" O
      where (O.value as Quantity).value < 90
  )

define "Recent pO2 Observations":
  [Observation: "Arterial pO2"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "Has Low Arterial pO2 Within 6 Hours":
  exists (
    "Recent pO2 Observations" O
      where (O.value as Quantity).value < 60
  )

define "Meets Hypoxia Criterion":
  "Has Low SpO2 Within 6 Hours" or "Has Low Arterial pO2 Within 6 Hours"

define "AdmissionCriteriaMet":
  "Has Acute Respiratory Failure Diagnosis" and "Meets Hypoxia Criterion"

define "DiagnosisMet":
  "Has Acute Respiratory Failure Diagnosis"

define "HypoxiaMet":
  "Meets Hypoxia Criterion"

define "MissingHypoxiaData":
  "Has Acute Respiratory Failure Diagnosis" and not "Meets Hypoxia Criterion"
    and not exists ("Recent SpO2 Observations")
    and not exists ("Recent pO2 Observations")
