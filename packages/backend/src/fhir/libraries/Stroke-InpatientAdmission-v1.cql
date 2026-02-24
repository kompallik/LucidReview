library Stroke_InpatientAdmission_v1 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'

// ── ICD-10-CM Diagnosis Codes ────────────────────────────────────────────────

code "Acute ischemic stroke unspecified": 'I63.9' from "ICD10CM"
code "Acute ischemic stroke I63.00": 'I63.00' from "ICD10CM"
code "Acute ischemic stroke I63.10": 'I63.10' from "ICD10CM"
code "Acute ischemic stroke I63.20": 'I63.20' from "ICD10CM"
code "Acute ischemic stroke I63.30": 'I63.30' from "ICD10CM"
code "Acute ischemic stroke I63.40": 'I63.40' from "ICD10CM"
code "Acute ischemic stroke I63.50": 'I63.50' from "ICD10CM"

code "TIA vertebrobasilar": 'G45.0' from "ICD10CM"
code "TIA carotid": 'G45.1' from "ICD10CM"
code "TIA unspecified": 'G45.9' from "ICD10CM"

code "Nontraumatic intracerebral hemorrhage unspecified": 'I61.9' from "ICD10CM"

code "Atrial fibrillation paroxysmal": 'I48.0' from "ICD10CM"
code "Atrial fibrillation I48.11": 'I48.11' from "ICD10CM"
code "Atrial fibrillation I48.19": 'I48.19' from "ICD10CM"
code "Atrial fibrillation I48.20": 'I48.20' from "ICD10CM"
code "Atrial fibrillation I48.21": 'I48.21' from "ICD10CM"
code "Atrial fibrillation unspecified": 'I48.91' from "ICD10CM"

// ── LOINC Observation Codes ──────────────────────────────────────────────────

code "Systolic blood pressure": '8480-6' from "LOINC"
code "Blood glucose": '2345-7' from "LOINC"
code "Glasgow Coma Scale total": '9269-2' from "LOINC"
code "Oxygen saturation SpO2": '2708-6' from "LOINC"
code "Patient age": '30525-0' from "LOINC"
code "NIHSS total score": '72089-6' from "LOINC"
code "ABCD2 score": '59408-5' from "LOINC"

// ── Parameters ───────────────────────────────────────────────────────────────

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

// ── Context ──────────────────────────────────────────────────────────────────

context Patient

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — QUALIFYING DIAGNOSIS LEAF EXPRESSIONS
// ════════════════════════════════════════════════════════════════════════════

define "AcuteIschemicStrokeCodes":
  { 'I63.9', 'I63.00', 'I63.10', 'I63.20', 'I63.30', 'I63.40', 'I63.50' }

define "TIACodes":
  { 'G45.0', 'G45.1', 'G45.9' }

define "ICHCodes":
  { 'I61.9' }

define "AtrialFibrillationCodes":
  { 'I48.0', 'I48.11', 'I48.19', 'I48.20', 'I48.21', 'I48.91' }

// Leaf: HasAcuteIschemicStrokeDiagnosis
define "HasAcuteIschemicStrokeDiagnosis":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.code in "AcuteIschemicStrokeCodes")
        and C.clinicalStatus.coding.exists(coding =>
              coding.code in { 'active', 'recurrence', 'relapse' })
  )

// Leaf: HasTIADiagnosis
define "HasTIADiagnosis":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.code in "TIACodes")
        and C.clinicalStatus.coding.exists(coding =>
              coding.code in { 'active', 'recurrence', 'relapse' })
  )

// Leaf: HasICHDiagnosis
define "HasICHDiagnosis":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.code in "ICHCodes")
        and C.clinicalStatus.coding.exists(coding =>
              coding.code in { 'active', 'recurrence', 'relapse' })
  )

// OR group: HasQualifyingStrokeTIADiagnosis
define "HasQualifyingStrokeTIADiagnosis":
  "HasAcuteIschemicStrokeDiagnosis"
    or "HasTIADiagnosis"
    or "HasICHDiagnosis"

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — ACUTE ISCHEMIC STROKE ADMISSION BRANCH
// ════════════════════════════════════════════════════════════════════════════

// ── 2a. Stroke confirmed on imaging / clinical assessment ────────────────────

// Leaf: AcuteIschemicStrokeConfirmed
// Represented by the presence of an active AIS diagnosis documented
// by an attending or neurologist. Clinical note confirmation is
// approximated via Condition resource with active clinical status.
define "AcuteIschemicStrokeConfirmed":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.code in "AcuteIschemicStrokeCodes")
        and C.clinicalStatus.coding.exists(coding =>
              coding.code in { 'active', 'recurrence', 'relapse' })
        and C.verificationStatus.coding.exists(coding =>
              coding.code in { 'confirmed' })
  )

// ── 2b. tPA Eligibility Window (AND branch) ──────────────────────────────────

// Leaf: SymptomOnsetWithin4Point5Hours
// Approximated via the Condition onset date/time relative to now.
define "RecentAISCondition":
  [Condition] C
    where C.code.coding.exists(coding => coding.code in "AcuteIschemicStrokeCodes")
      and C.clinicalStatus.coding.exists(coding =>
            coding.code in { 'active', 'recurrence', 'relapse' })

define "SymptomOnsetWithin4Point5Hours":
  exists (
    "RecentAISCondition" C
      where C.onset is not null
        and (
          (C.onset as dateTime) >= (Now() - 4 hours 30 minutes)
        )
  )

// Leaf: NIHSSGreaterThanOrEqualTo4
define "RecentNIHSSObservations":
  [Observation: "NIHSS total score"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 24 hours)

define "NIHSSGreaterThanOrEqualTo4":
  exists (
    "RecentNIHSSObservations" O
      where (O.value as Quantity).value >= 4
  )

// Leaf: NoAbsoluteTPAContraindications
// Approximated by absence of a ServiceRequest or flag indicating tPA
// contraindication. In practice this is documented in a clinical note;
// here we check for absence of an explicit contraindication flag.
define "AbsoluteTPAContraindicationFlag":
  [ServiceRequest] SR
    where SR.status in { 'active', 'on-hold', 'completed' }
      and SR.code.coding.exists(coding =>
            coding.system = 'http://snomed.info/sct'
              and coding.code = '182992009')

define "NoAbsoluteTPAContraindications":
  not exists ("AbsoluteTPAContraindicationFlag")

// AND branch: TPAEligibilityWindowMet
define "TPAEligibilityWindowMet":
  "SymptomOnsetWithin4Point5Hours"
    and "NIHSSGreaterThanOrEqualTo4"
    and "NoAbsoluteTPAContraindications"

// ── 2c. Mechanical Thrombectomy Eligibility (AND branch) ─────────────────────

// Leaf: LargeVesselOcclusionConfirmed
// Represented by a confirmed Condition or a completed diagnostic imaging
// procedure noting LVO on CTA/MRA. We use a DiagnosticReport / Condition
// approach — approximate with a Condition code for LVO.
define "LVOConditionCodes":
  { 'I66.01', 'I66.11', 'I66.21', 'I66.9', 'I66.3' }

define "LargeVesselOcclusionConfirmed":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.code in "LVOConditionCodes")
        and C.clinicalStatus.coding.exists(coding =>
              coding.code in { 'active', 'recurrence', 'relapse' })
        and C.verificationStatus.coding.exists(coding =>
              coding.code in { 'confirmed' })
  )

// Leaf: WithinThrombectomyWindow
define "WithinThrombectomyWindow":
  exists (
    "RecentAISCondition" C
      where C.onset is not null
        and (C.onset as dateTime) >= (Now() - 24 hours)
  )

// AND branch: ThrombectomyEligibilityMet
define "ThrombectomyEligibilityMet":
  "LargeVesselOcclusionConfirmed"
    and "WithinThrombectomyWindow"

// ── 2d. Continuous Monitoring Required (AND branch) ──────────────────────────

// Leaf: BloodPressureRequiresInpatientManagement
define "RecentSystolicBPObservations":
  [Observation: "Systolic blood pressure"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "BloodPressureRequiresInpatientManagement":
  exists (
    "RecentSystolicBPObservations" O
      where (O.value as Quantity).value >= 180
  )

// Leaf: ContinuousCardiacMonitoringRequired
// Approximated by the presence of an active cardiac monitoring ServiceRequest.
define "ContinuousCardiacMonitoringRequired":
  exists (
    [ServiceRequest] SR
      where SR.status in { 'active', 'on-hold' }
        and SR.intent in { 'order', 'original-order', 'reflex-order' }
        and SR.code.coding.exists(coding =>
              (coding.system = 'http://snomed.info/sct'
                and coding.code in { '252465000', '59490002' })
              or (coding.system = 'http://www.ama-assn.org/go/cpt'
                and coding.code in { '93268', '93270', '93271', '93272' }))
  )

// Leaf: GlucoseRequiresInpatientManagement
define "RecentGlucoseObservations":
  [Observation: "Blood glucose"] O
    where O.status in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as dateTime) >= (Now() - 6 hours)

define "GlucoseRequiresInpatientManagement":
  exists (
    "RecentGlucoseObservations" O
      where (O.value as Quantity).value > 180
         or (O.value as Quantity).value < 60
  )

// AND branch: ContinuousMonitoringRequired (at least one sub-criterion)
define "ContinuousMonitoringRequiredMet":
  "BloodPressureRequiresInpatientManagement"
    or "ContinuousCardiacMonitoringRequired"
    or "GlucoseRequiresInpatientManagement"

// ── 2e. Persistent Neurological Deficit ──────────────────────────────────────

// Leaf: PersistentNeurologicalDeficitPresent
// Approximated by NIHSS > 0 on recent assessment or a neurological deficit
// Condition being active.
define "NeurologicalDeficitConditionCodes":
  { 'R29.810', 'R47.01', 'H53.40', 'R20.2', 'R27.0' }

define "PersistentNeurologicalDeficitPresent":
  exists (
    [Condition] C
      where C.code.coding.exists(coding =>
              coding.code in "NeurologicalDeficitConditionCodes")
        and C.clinicalStatus.coding.exists(coding =>
              coding.code in { 'active', 'recurrence', 'relapse' })
  )
  or exists (
    "RecentNIHSSObservations" O
      where (O.value as Quantity).value > 0
  )

// ── 2f. AIS Management Criterion OR group ────────────────────────────────────

define "AISManagementCriterionMet":
  "TPAEligibilityWindowMet"
    or "ThrombectomyEligibilityMet"
    or "ContinuousMonitoringRequiredMet"
    or "PersistentNeurologicalDeficitPresent"

// ── 2g. Full AIS Admission Branch (AND) ──────────────────────────────────────

define "AISAdmissionBranchMet":
  "AcuteIschemicStrokeConfirmed"
    and "AISManagementCriterionMet"

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — TIA HIGH-RISK ADMISSION BRANCH
// ════════════════════════════════════════════════════════════════════════════

// Leaf: TIADiagnosisConfirmed
define "TIADiagnosisConfirmed":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.code in "TIACodes")
        and C.clinicalStatus.coding.exists(coding =>
              coding.code in { 'active', 'recurrence', 'relapse' })
        and C.verificationStatus.coding.exists(coding =>