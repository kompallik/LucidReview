library UM_InpatientAdmission_AcuteRespFailure version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'
codesystem "CPT": 'http://www.ama-assn.org/go/cpt'

valueset "Acute Respiratory Failure Diagnoses": 'http://lucidreview.dev/ValueSet/acute-respiratory-failure'
valueset "Medicare Part A Coverage Types": 'http://lucidreview.dev/ValueSet/medicare-part-a-coverage'
valueset "Non-Invasive Ventilation Procedures": 'http://lucidreview.dev/ValueSet/non-invasive-ventilation'
valueset "Inpatient Monitoring Procedures": 'http://lucidreview.dev/ValueSet/inpatient-monitoring'

// ICD-10 Diagnosis Codes — Acute Respiratory Failure
code "Acute respiratory failure, unspecified, without mention of hypoxia/hypercapnia": 'J96.00' from "ICD10CM" display 'Acute respiratory failure, unspecified'
code "Acute respiratory failure with hypoxia": 'J96.01' from "ICD10CM" display 'Acute respiratory failure with hypoxia'
code "Acute respiratory failure with hypercapnia": 'J96.09' from "ICD10CM" display 'Acute respiratory failure with hypercapnia'
code "Respiratory failure, unspecified, unspecified whether with hypoxia or hypercapnia": 'J96.90' from "ICD10CM" display 'Respiratory failure, unspecified'
code "Respiratory failure, unspecified, with hypoxia": 'J96.91' from "ICD10CM" display 'Respiratory failure, unspecified, with hypoxia'
code "Respiratory failure, unspecified, with hypercapnia": 'J96.99' from "ICD10CM" display 'Respiratory failure, unspecified, with hypercapnia'

// LOINC Observation Codes
code "SpO2 by pulse oximetry": '2708-6' from "LOINC" display 'Oxygen saturation in Arterial blood'
code "SpO2 by pulse oximetry 59408": '59408-5' from "LOINC" display 'Oxygen saturation by pulse oximetry'
code "Arterial pO2": '2703-7' from "LOINC" display 'Oxygen [Partial pressure] in Arterial blood'
code "Respiratory rate": '9279-1' from "LOINC" display 'Respiratory rate'
code "Arterial pCO2": '2019-8' from "LOINC" display 'Carbon dioxide [Partial pressure] in Arterial blood'
code "Arterial blood pH": '2744-1' from "LOINC" display 'pH of Arterial blood'

// CPT Procedure Codes — Inpatient-Level Interventions
code "CPAP BiPAP initiation": '94660' from "CPT" display 'CPAP/BiPAP initiation and management'
code "Ventilation management": '94002' from "CPT" display 'Ventilation management, hospital inpatient'
code "Continuous pulse oximetry": '94760' from "CPT" display 'Noninvasive ear or pulse oximetry single determination'

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

parameter "Acute Observation Window Hours" Integer
  default 12

parameter "Lab Result Window Hours" Integer
  default 24

context Patient

//
// ─── SECTION 1: COVERAGE ────────────────────────────────────────────────────────
//

define "Active Medicare Coverage":
  [Coverage] C
    where C.status = 'active'
      and C.type.coding.code in { 'Medicare', 'MEDICARE', 'part-a', 'MA' }

define "Has Active Medicare Part A Coverage":
  exists (
    [Coverage] C
      where C.status = 'active'
        and (
          C.type.coding.code in { 'Medicare', 'MEDICARE', 'part-a', 'MA' }
            or C.class.exists(cl | cl.type.coding.code in { 'part-a', 'partA', 'PARTA' })
        )
  )
    or exists (
      [Coverage] C
        where C.status = 'active'
          and C.payor.exists()
          and C.subscriberId is not null
    )

define "CoverageMet":
  "Has Active Medicare Part A Coverage"

//
// ─── SECTION 2: QUALIFYING DIAGNOSIS ────────────────────────────────────────────
//

define "Acute Respiratory Failure Condition Codes":
  {
    'J96.00', 'J96.01', 'J96.09',
    'J96.90', 'J96.91', 'J96.99'
  }

define "Active Respiratory Failure Conditions":
  [Condition] C
    where C.code.coding.exists(coding | coding.code in "Acute Respiratory Failure Condition Codes")
      and C.clinicalStatus.coding.code in { 'active', 'recurrence', 'relapse' }

define "Has Qualifying Respiratory Failure Diagnosis":
  exists ("Active Respiratory Failure Conditions")

define "DiagnosisMet":
  "Has Qualifying Respiratory Failure Diagnosis"

//
// ─── SECTION 3: HYPOXEMIA ────────────────────────────────────────────────────────
//

define "Recent SpO2 Observations":
  (
    [Observation: "SpO2 by pulse oximetry"]
      union [Observation: "SpO2 by pulse oximetry 59408"]
  ) O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - System.Quantity { value: "Acute Observation Window Hours", unit: 'h' })

define "Has Low SpO2":
  exists (
    "Recent SpO2 Observations" O
      where (O.value as FHIR.Quantity).value < 90
  )

define "SpO2Met":
  "Has Low SpO2"

define "Recent Arterial pO2 Observations":
  [Observation: "Arterial pO2"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - System.Quantity { value: "Lab Result Window Hours", unit: 'h' })

define "Has Low Arterial pO2":
  exists (
    "Recent Arterial pO2 Observations" O
      where (O.value as FHIR.Quantity).value < 60
  )

define "pO2Met":
  "Has Low Arterial pO2"

define "HypoxemiaMet":
  "Has Low SpO2" or "Has Low Arterial pO2"

//
// ─── SECTION 4: VENTILATORY FAILURE / RESPIRATORY DISTRESS ───────────────────────
//

define "Recent Respiratory Rate Observations":
  [Observation: "Respiratory rate"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - System.Quantity { value: "Acute Observation Window Hours", unit: 'h' })

define "Has Elevated Respiratory Rate":
  exists (
    "Recent Respiratory Rate Observations" O
      where (O.value as FHIR.Quantity).value > 25
  )

define "RespRateMet":
  "Has Elevated Respiratory Rate"

define "Recent Arterial pCO2 Observations":
  [Observation: "Arterial pCO2"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - System.Quantity { value: "Lab Result Window Hours", unit: 'h' })

define "Has Hypercapnia":
  exists (
    "Recent Arterial pCO2 Observations" O
      where (O.value as FHIR.Quantity).value > 45
  )

define "HypercapniaMet":
  "Has Hypercapnia"

define "Recent Arterial pH Observations":
  [Observation: "Arterial blood pH"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - System.Quantity { value: "Lab Result Window Hours", unit: 'h' })

define "Has Respiratory Acidosis":
  exists (
    "Recent Arterial pH Observations" O
      where (O.value as FHIR.Quantity).value < 7.35
  )

define "AcidosisMet":
  "Has Respiratory Acidosis"

define "VentilatoryFailureMet":
  "Has Elevated Respiratory Rate"
    or "Has Hypercapnia"
    or "Has Respiratory Acidosis"

//
// ─── SECTION 5: CLINICAL EVIDENCE (COMPOSITE) ────────────────────────────────────
//

define "ClinicalEvidenceMet":
  "HypoxemiaMet" and "VentilatoryFailureMet"

//
// ─── SECTION 6: TREATMENT FAILURE / LOWER-LEVEL CARE ────────────────────────────
//

define "Treatment Failure Clinical Notes":
  [DocumentReference] D
    where D.status = 'current'
      and D.docStatus in { 'final', 'amended' }
      and D.date >= (Now() - System.Quantity { value: 30, unit: 'd' })
      and (
        D.type.coding.code in { '34109-9', '11506-3', '18842-5', '34117-2' }
          or D.category.coding.code in { 'clinical-note', 'progress-note', 'discharge-summary' }
      )

define "Has Treatment Failure Documentation":
  exists ("Treatment Failure Clinical Notes")

define "TreatmentFailureMet":
  "Has Treatment Failure Documentation"

//
// ─── SECTION 7: INPATIENT-LEVEL NEED ─────────────────────────────────────────────
//

define "Non-Invasive Ventilation Procedure Codes":
  { '94660', '94002', '94003', '94005' }

define "Inpatient Monitoring Procedure Codes":
  { '94760', '94761', '94762', '99291', '99292' }

define "Recent NIV Procedures":
  [Procedure] P
    where P.status in { 'in-progress', 'completed' }
      and P.code.coding.code in "Non-Invasive Ventilation Procedure Codes"
      and (P.performed as dateTime) >= (Now() - System.Quantity { value: 48, unit: 'h' })

define "Recent Inpatient Monitoring Procedures":
  [Procedure] P
    where P.status in { 'in-progress', 'completed' }
      and P.code.coding.code in "Inpatient Monitoring Procedure Codes"
      and (P.performed as dateTime) >= (Now() - System.Quantity { value: 48, unit: 'h' })

define "Ordered NIV Procedures":
  [ServiceRequest] SR
    where SR.status in { 'active', 'completed' }
      and SR.intent in { 'order', 'original-order', 'filler-order' }
      and SR.code.coding.code in "Non-Invasive Ventilation Procedure Codes"
      and (SR.authoredOn) >= (Now() - System.Quantity { value: 48, unit: 'h' })

define "Ordered Inpatient Monitoring":
  [ServiceRequest] SR
    where SR.status in { 'active', 'completed' }
      and SR.intent in { 'order', 'original-order', 'filler-order' }
      and SR.code.coding.code in "Inpatient Monitoring Procedure Codes"
      and (SR.authoredOn) >= (Now() - System.Quantity { value: 48, unit: 'h' })

define "Has Inpatient-Level Procedure or Order":
  exists ("Recent NIV Procedures")
    or exists ("Recent Inpatient Monitoring Procedures")
    or exists ("Ordered NIV Procedures")
    or exists ("Ordered Inpatient Monitoring")

define "InpatientNeedMet":
  "Has Inpatient-Level Procedure or Order"

//
// ─── SECTION 8: INDIVIDUAL CRITERION SUMMARY DEFINES ─────────────────────────────
//

define "DiagnosisCriterionMet":
  "DiagnosisMet"

define "HypoxiaCriterionMet":
  "HypoxemiaMet"

define "VentilatoryCriterionMet":
  "VentilatoryFailureMet"

define "ClinicalEvidenceCriterionMet":
  "ClinicalEvidenceMet"

define "TreatmentFailureCriterionMet":
  "TreatmentFailureMet"

define "InpatientNeedCriterionMet":
  "InpatientNeedMet"

define "CoverageCriterionMet":
  "CoverageMet"

//
// ─── SECTION 9: MISSING DATA FLAGS ───────────────────────────────────────────────
//

define "Missing SpO2 Data":
  not exists ("Recent SpO2 Observations")

define "Missing pO2 Data":
  not exists ("Recent Arterial pO2 Observations")

define "Missing Hypoxemia Data":
  "Missing SpO2 Data" and "Missing pO2 Data"

define "Missing Respiratory Rate Data":
  not exists ("Recent Respiratory Rate Observations")

define "Missing pCO2 Data":
  not exists ("Recent Arterial pCO2 Observations")

define "Missing pH Data":
  not exists ("Recent Arterial pH Observations")

define "Missing Ventilatory Failure Data":
  "Missing Respiratory Rate Data" and "Missing pCO2 Data" and "Missing pH Data"

define "Missing Clinical Evidence Data":
  "Missing Hypoxemia Data" or "Missing Ventilatory Failure Data"

define "Missing Treatment Failure Documentation":
  not exists ("Treatment Failure Clinical Notes")

define "Missing Inpatient Need Documentation":
  not exists ("Recent NIV Procedures")
    and not exists ("Recent Inpatient Monitoring Procedures")
    and not exists ("Ordered NIV Procedures")
    and not exists ("Ordered Inpatient Monitoring")

define "Missing Coverage Data":
  not exists ([Coverage])

//
// ─── SECTION 10: CRITERION FAILURE REASONS ───────────────────────────────────────
//

define "Failed Coverage Criterion":
  not "CoverageMet"

define "Failed Diagnosis Criterion":
  not "DiagnosisMet"

define "Failed Hypoxemia Criterion":
  not "HypoxemiaMet"

define "Failed Ventilatory Failure Criterion":
  not "VentilatoryFailureMet"

define "Failed Clinical Evidence Criterion":
  not "ClinicalE