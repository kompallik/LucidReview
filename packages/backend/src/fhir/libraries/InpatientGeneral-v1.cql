library InpatientGeneral_v1 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'
codesystem "CPT": 'http://www.ama-assn.org/go/cpt'
codesystem "HCPCS": 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets'

valueset "Acute Inpatient Diagnoses": 'http://lucidreview.dev/ValueSet/acute-inpatient-diagnoses'
valueset "Subacute Inpatient Diagnoses": 'http://lucidreview.dev/ValueSet/subacute-inpatient-diagnoses'
valueset "Inpatient Only Procedures": 'http://lucidreview.dev/ValueSet/inpatient-only-procedures'
valueset "Continuous IV Medication Procedures": 'http://lucidreview.dev/ValueSet/continuous-iv-medication'
valueset "Active Coverage Status Codes": 'http://lucidreview.dev/ValueSet/active-coverage-status'

code "Continuous infusion intravenous": '96365' from "CPT" display 'IV infusion, therapy/prophylaxis'
code "Continuous IV push": '96374' from "CPT" display 'Therapeutic IV push, single'
code "Central venous monitoring": '93503' from "CPT" display 'Insertion and placement of flow directed catheter'
code "Arterial line monitoring": '36620' from "CPT" display 'Arterial catheterization or cannulation for sampling'
code "Telemetry monitoring SNOMED": '182777000' from "SNOMEDCT" display 'Continuous cardiac monitoring'
code "Skilled nursing observation SNOMED": '410155007' from "SNOMEDCT" display '24-hour skilled nursing care'
code "Inpatient admission order SNOMED": '305342006' from "SNOMEDCT" display 'Admission to inpatient hospital'
code "Cannot be managed outpatient SNOMED": '3457005' from "SNOMEDCT" display 'Patient referral'
code "Acute care inpatient SNOMED": '11429006' from "SNOMEDCT" display 'Consultation'

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

parameter "Admission DateTime" DateTime
  default Now()

context Patient

// ---------------------------------------------------------------------------
// COVERAGE
// ---------------------------------------------------------------------------

define "Has Active Inpatient Coverage":
  exists (
    [Coverage] C
      where C.status = 'active'
        and exists (
          C.type.coding coding
            where coding.code in { 'AMB', 'IMP', 'ACUTE', 'SS', 'NONAC' }
        )
        and (
          C.period is null
          or (
            C.period.start is not null
            and C.period.start <= "Admission DateTime"
            and (
              C.period.end is null
              or C.period.end >= "Admission DateTime"
            )
          )
        )
  )

define "CoverageMet":
  "Has Active Inpatient Coverage"

// ---------------------------------------------------------------------------
// ACUTE OR SUBACUTE CONDITION
// ---------------------------------------------------------------------------

define "Active Acute Inpatient Conditions":
  [Condition] C
    where (
      exists (
        C.clinicalStatus.coding cs
          where cs.code in { 'active', 'recurrence', 'relapse' }
      )
    )
    and (
      exists (
        C.category cat
          where exists (
            cat.coding catCoding
              where catCoding.code in { 'encounter-diagnosis', 'problem-list-item' }
          )
      )
    )
    and (
      C.onset is not null
      or C.recordedDate is not null
    )

define "Has Acute Diagnosis From Valueset":
  exists (
    "Active Acute Inpatient Conditions" C
      where exists (
        C.code.coding coding
          where coding memberOf "Acute Inpatient Diagnoses"
      )
  )

define "Has Subacute Diagnosis From Valueset":
  exists (
    "Active Acute Inpatient Conditions" C
      where exists (
        C.code.coding coding
          where coding memberOf "Subacute Inpatient Diagnoses"
      )
  )

define "Has Acute Or Subacute Condition":
  "Has Acute Diagnosis From Valueset"
    or "Has Subacute Diagnosis From Valueset"

define "AcuteConditionMet":
  "Has Acute Or Subacute Condition"

// ---------------------------------------------------------------------------
// CANNOT BE SAFELY MANAGED OUTPATIENT OR OBSERVATION
// ---------------------------------------------------------------------------

define "Clinical Notes Within 24 Hours":
  [DocumentReference] D
    where D.status = 'current'
      and (
        D.date is not null
        and D.date >= ("Admission DateTime" - 24 hours)
      )

define "Physician Notes Within 24 Hours":
  "Clinical Notes Within 24 Hours" D
    where exists (
      D.type.coding coding
        where coding.code in {
          '11488-4',
          '34111-5',
          '34112-3',
          '18842-5',
          '11506-3',
          '34109-9',
          '51847-2',
          '34117-2',
          '68469-6',
          '68470-4'
        }
    )

define "Has Outpatient Inadequacy Documentation":
  exists (
    "Physician Notes Within 24 Hours" D
      where exists (
        D.content content
          where content.attachment.title is not null
            and (
              content.attachment.title contains 'inpatient'
              or content.attachment.title contains 'admission'
              or content.attachment.title contains 'cannot be managed'
              or content.attachment.title contains 'requires hospitalization'
            )
      )
  )

define "Has Inpatient Admission ServiceRequest":
  exists (
    [ServiceRequest] SR
      where SR.status in { 'active', 'completed' }
        and SR.intent in { 'order', 'original-order', 'reflex-order', 'filler-order' }
        and exists (
          SR.code.coding coding
            where coding.code in {
              '305342006',
              '32485007',
              '74857009',
              '19712007'
            }
            and coding.system = 'http://snomed.info/sct'
        )
        and (
          SR.authoredOn is not null
          and SR.authoredOn >= ("Admission DateTime" - 24 hours)
        )
  )

define "NotOutpatientMet":
  "Has Outpatient Inadequacy Documentation"
    or "Has Inpatient Admission ServiceRequest"

// ---------------------------------------------------------------------------
// IV THERAPY CRITERION
// ---------------------------------------------------------------------------

define "IV Therapy Procedures Within 24 Hours":
  [Procedure] P
    where P.status in { 'in-progress', 'completed' }
      and (
        P.performed is not null
        and (P.performed as dateTime) >= ("Admission DateTime" - 24 hours)
      )
      and (
        exists (
          P.code.coding coding
            where coding.code in { '96365', '96366', '96367', '96368', '96374', '96375', '96376' }
            and coding.system = 'http://www.ama-assn.org/go/cpt'
        )
        or exists (
          P.code.coding coding
            where coding memberOf "Continuous IV Medication Procedures"
        )
      )

define "IV Monitoring Procedures Within 24 Hours":
  [Procedure] P
    where P.status in { 'in-progress', 'completed' }
      and (
        P.performed is not null
        and (P.performed as dateTime) >= ("Admission DateTime" - 24 hours)
      )
      and exists (
        P.code.coding coding
          where coding.code in { '93503', '36620', '93561', '93562' }
          and coding.system = 'http://www.ama-assn.org/go/cpt'
      )

define "Has Continuous IV Therapy Or Monitoring":
  exists ("IV Therapy Procedures Within 24 Hours")
    or exists ("IV Monitoring Procedures Within 24 Hours")

define "IVTherapyMet":
  "Has Continuous IV Therapy Or Monitoring"

// ---------------------------------------------------------------------------
// 24-HOUR SKILLED NURSING CRITERION
// ---------------------------------------------------------------------------

define "Skilled Nursing Clinical Notes Within 24 Hours":
  "Clinical Notes Within 24 Hours" D
    where exists (
      D.type.coding coding
        where coding.code in {
          '34119-8',
          '34120-6',
          '28651-8',
          '34746-8',
          '11488-4'
        }
        and coding.system = 'http://loinc.org'
    )

define "Skilled Nursing ServiceRequests Within 24 Hours":
  [ServiceRequest] SR
    where SR.status in { 'active', 'completed' }
      and SR.intent in { 'order', 'original-order', 'filler-order' }
      and exists (
        SR.code.coding coding
          where coding.code in {
            '410155007',
            '182777000',
            '91251008',
            '385763009'
          }
          and coding.system = 'http://snomed.info/sct'
      )
      and (
        SR.authoredOn is not null
        and SR.authoredOn >= ("Admission DateTime" - 24 hours)
      )

define "Has 24 Hour Skilled Nursing Requirement":
  exists ("Skilled Nursing Clinical Notes Within 24 Hours")
    or exists ("Skilled Nursing ServiceRequests Within 24 Hours")

define "NursingCareMet":
  "Has 24 Hour Skilled Nursing Requirement"

// ---------------------------------------------------------------------------
// INPATIENT-ONLY SURGICAL PROCEDURE CRITERION
// ---------------------------------------------------------------------------

define "Inpatient Surgical Procedures Within 30 Days":
  [Procedure] P
    where P.status in { 'in-progress', 'completed', 'preparation' }
      and (
        P.performed is not null
        and (P.performed as dateTime) >= ("Admission DateTime" - 30 days)
        and (P.performed as dateTime) <= ("Admission DateTime" + 1 day)
      )
      and exists (
        P.code.coding coding
          where coding memberOf "Inpatient Only Procedures"
      )

define "Planned Inpatient Surgical Procedures":
  [ServiceRequest] SR
    where SR.status in { 'active', 'on-hold' }
      and SR.intent in { 'order', 'original-order', 'filler-order' }
      and exists (
        SR.code.coding coding
          where coding memberOf "Inpatient Only Procedures"
      )
      and (
        SR.authoredOn is not null
        and SR.authoredOn >= ("Admission DateTime" - 30 days)
      )

define "Has Inpatient Only Surgical Procedure":
  exists ("Inpatient Surgical Procedures Within 30 Days")
    or exists ("Planned Inpatient Surgical Procedures")

define "SurgicalMet":
  "Has Inpatient Only Surgical Procedure"

// ---------------------------------------------------------------------------
// INPATIENT-LEVEL RESOURCE REQUIREMENT (OR group)
// ---------------------------------------------------------------------------

define "RequiresMonitoringMet":
  "IVTherapyMet"
    or "NursingCareMet"
    or "SurgicalMet"

// ---------------------------------------------------------------------------
// INDIVIDUAL CRITERION GROUP SUMMARIES
// ---------------------------------------------------------------------------

define "DiagnosisMet":
  "AcuteConditionMet"

define "OutpatientInadequacyMet":
  "NotOutpatientMet"

// ---------------------------------------------------------------------------
// MISSING DATA FLAGS
// ---------------------------------------------------------------------------

define "MissingCoverageData":
  not "Has Active Inpatient Coverage"

define "MissingAcuteDiagnosisData":
  not exists ("Active Acute Inpatient Conditions")

define "MissingOutpatientDocumentation":
  not "Has Outpatient Inadequacy Documentation"
    and not "Has Inpatient Admission ServiceRequest"

define "MissingIVTherapyData":
  not exists ("IV Therapy Procedures Within 24 Hours")
    and not exists ("IV Monitoring Procedures Within 24 Hours")

define "MissingNursingCareData":
  not exists ("Skilled Nursing Clinical Notes Within 24 Hours")
    and not exists ("Skilled Nursing ServiceRequests Within 24 Hours")

define "MissingSurgicalData":
  not exists ("Inpatient Surgical Procedures Within 30 Days")
    and not exists ("Planned Inpatient Surgical Procedures")

define "MissingInpatientResourceData":
  "MissingIVTherapyData"
    and "MissingNursingCareData"
    and "MissingSurgicalData"

// ---------------------------------------------------------------------------
// TOP-LEVEL ADMISSION CRITERIA
// ---------------------------------------------------------------------------

define "AdmissionCriteriaMet":
  "CoverageMet"
    and "AcuteConditionMet"
    and "NotOutpatientMet"
    and "RequiresMonitoringMet"