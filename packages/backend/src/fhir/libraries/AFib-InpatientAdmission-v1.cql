library AFib_InpatientAdmission_v1 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'

// ─── AFib Diagnosis Codes ───────────────────────────────────────────────────
code "AFib paroxysmal": 'I48.0' from "ICD10CM"
code "AFib typical atrial flutter": 'I48.11' from "ICD10CM"
code "AFib other atrial flutter": 'I48.19' from "ICD10CM"
code "AFib persistent unspecified": 'I48.20' from "ICD10CM"
code "AFib persistent": 'I48.21' from "ICD10CM"
code "AFib unspecified": 'I48.9' from "ICD10CM"
code "AFib longstanding persistent": 'I48.91' from "ICD10CM"
code "AFib chronic": 'I48.92' from "ICD10CM"

// ─── Heart Failure Diagnosis Codes ──────────────────────────────────────────
code "HF systolic acute": 'I50.21' from "ICD10CM"
code "HF systolic acute on chronic": 'I50.23' from "ICD10CM"
code "HF diastolic acute": 'I50.31' from "ICD10CM"
code "HF diastolic acute on chronic": 'I50.33' from "ICD10CM"
code "HF combined systolic diastolic acute": 'I50.41' from "ICD10CM"
code "HF combined systolic diastolic acute on chronic": 'I50.43' from "ICD10CM"
code "HF right heart acute": 'I50.811' from "ICD10CM"
code "HF right heart acute on chronic": 'I50.813' from "ICD10CM"
code "HF unspecified": 'I50.9' from "ICD10CM"

// ─── WPW / Pre-Excitation Codes ─────────────────────────────────────────────
code "WPW syndrome": 'I45.6' from "ICD10CM"
code "Congenital cardiac anomaly other": 'Q24.8' from "ICD10CM"

// ─── Stroke / TIA Diagnosis Codes ───────────────────────────────────────────
code "Stroke unspecified occlusion cerebral artery I63.00": 'I63.00' from "ICD10CM"
code "Stroke unspecified occlusion precerebral I63.01": 'I63.01' from "ICD10CM"
code "Stroke unspecified occlusion precerebral bilateral I63.02": 'I63.02' from "ICD10CM"
code "Stroke thrombosis precerebral I63.10": 'I63.10' from "ICD10CM"
code "Stroke thrombosis precerebral right I63.11": 'I63.11' from "ICD10CM"
code "Stroke thrombosis precerebral left I63.12": 'I63.12' from "ICD10CM"
code "Stroke thrombosis cerebral I63.20": 'I63.20' from "ICD10CM"
code "Stroke embolism precerebral I63.30": 'I63.30' from "ICD10CM"
code "Stroke embolism cerebral I63.40": 'I63.40' from "ICD10CM"
code "Stroke occlusion cerebral I63.50": 'I63.50' from "ICD10CM"
code "Stroke unspecified I63.9": 'I63.9' from "ICD10CM"
code "TIA unspecified G45.9": 'G45.9' from "ICD10CM"
code "Basilar artery syndrome G45.0": 'G45.0' from "ICD10CM"
code "Carotid artery syndrome G45.1": 'G45.1' from "ICD10CM"
code "Multiple bilateral precerebral syndromes G45.2": 'G45.2' from "ICD10CM"
code "Other TIA G45.8": 'G45.8' from "ICD10CM"

// ─── LOINC Vital Sign Codes ──────────────────────────────────────────────────
code "Systolic blood pressure": '8480-6' from "LOINC"
code "Heart rate": '8867-4' from "LOINC"

// ─── Parameters ──────────────────────────────────────────────────────────────
parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

context Patient

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — CODE LISTS (inline concept sets for Condition lookups)
// ════════════════════════════════════════════════════════════════════════════

define "AFib ICD10 Codes":
  { 'I48.0', 'I48.11', 'I48.19', 'I48.20', 'I48.21', 'I48.9', 'I48.91', 'I48.92' }

define "Acute HF ICD10 Codes":
  { 'I50.21', 'I50.23', 'I50.31', 'I50.33', 'I50.41', 'I50.43', 'I50.811', 'I50.813', 'I50.9' }

define "WPW ICD10 Codes":
  { 'I45.6', 'Q24.8' }

define "Stroke TIA ICD10 Codes":
  { 'I63.00', 'I63.01', 'I63.02', 'I63.10', 'I63.11', 'I63.12',
    'I63.20', 'I63.30', 'I63.40', 'I63.50', 'I63.9',
    'G45.9', 'G45.0', 'G45.1', 'G45.2', 'G45.8' }

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

define "Active Condition Status Codes":
  { 'active', 'recurrence', 'relapse' }

define "Valid Observation Status Codes":
  { 'final', 'amended', 'corrected' }

// Returns true if any coding in a CodeableConcept has a code in the supplied set
define function "HasCodeInSet"(concept FHIR.CodeableConcept, codeSet List<String>):
  exists (
    concept.coding C
      where C.code.value in codeSet
  )

// Returns true if a Condition resource has an active clinical status
define function "IsActiveCondition"(c FHIR.Condition):
  exists (
    c.clinicalStatus.coding cs
      where cs.code.value in "Active Condition Status Codes"
  )

// Returns true if an Observation has an acceptable status
define function "IsValidObservation"(o FHIR.Observation):
  o.status.value in "Valid Observation Status Codes"

// Extracts the effective dateTime from an Observation (handles dateTime only)
define function "ObservationDateTime"(o FHIR.Observation):
  if o.effective is FHIR.dateTime then
    (o.effective as FHIR.dateTime).value
  else
    null

// Returns true if an Observation is within N hours of now
define function "ObservationWithinHours"(o FHIR.Observation, hours Integer):
  "ObservationDateTime"(o) is not null
    and "ObservationDateTime"(o) >= (Now() - System.Quantity { value: hours, unit: 'h' })

// Returns true if a DocumentReference or DiagnosticReport note text contains
// any of the supplied phrases (case-insensitive match via lower-case)
define function "NoteContainsAnyPhrase"(noteText String, phrases List<String>):
  exists (
    phrases phrase
      where Lower(noteText) ~ Lower(phrase)
  )

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — LEAF EXPRESSIONS
// ════════════════════════════════════════════════════════════════════════════

// ─── LEAF: HasQualifyingAFibDiagnosis ────────────────────────────────────────
// Checks for an active Condition with any qualifying AFib ICD-10 code
define "HasQualifyingAFibDiagnosis":
  exists (
    [Condition] C
      where "HasCodeInSet"(C.code, "AFib ICD10 Codes")
        and "IsActiveCondition"(C)
  )

// ─── LEAF: SystolicBPLessThan90 ─────────────────────────────────────────────
// Systolic BP observation (LOINC 8480-6) < 90 mmHg within the last 24 hours
define "Recent SBP Observations":
  [Observation: "Systolic blood pressure"] O
    where "IsValidObservation"(O)
      and "ObservationWithinHours"(O, 24)

define "SystolicBPLessThan90":
  exists (
    "Recent SBP Observations" O
      where (O.value as FHIR.Quantity).value < 90
  )

// ─── LEAF: SevereSymptomsDocumented ─────────────────────────────────────────
// Searches DocumentReference resources (clinical notes) for severe symptom phrases
define "Severe Symptom Phrases":
  { 'chest pain', 'syncope', 'severe dyspnea', 'presyncope', 'acute respiratory distress' }

define "Recent Clinical Notes":
  [DocumentReference] D
    where D.status.value = 'current'
      and exists (
        D.content c
          where c.attachment is not null
            and c.attachment.creation.value >= (Now() - System.Quantity { value: 48, unit: 'h' })
      )

define "SevereSymptomsDocumented":
  exists (
    [DocumentReference] D
      where D.status.value = 'current'
        and exists (
          D.content c
            where c.attachment.data is not null
              and "NoteContainsAnyPhrase"(
                ToString(c.attachment.data),
                "Severe Symptom Phrases"
              )
        )
  )

// ─── LEAF: HeartRateGreaterThan150 ───────────────────────────────────────────
// Heart rate observation (LOINC 8867-4) > 150 bpm within last 24 hours
define "Recent Heart Rate Observations":
  [Observation: "Heart rate"] O
    where "IsValidObservation"(O)
      and "ObservationWithinHours"(O, 24)

define "HeartRateGreaterThan150":
  exists (
    "Recent Heart Rate Observations" O
      where (O.value as FHIR.Quantity).value > 150
  )

// ─── LEAF: HemodynamicCompromiseWithRVR ─────────────────────────────────────
// Searches clinical notes for hemodynamic compromise phrases in the context of RVR
define "Hemodynamic Compromise Phrases":
  { 'hypotension', 'altered mental status', 'end-organ hypoperfusion', 'hemodynamic compromise' }

define "HemodynamicCompromiseWithRVR":
  exists (
    [DocumentReference] D
      where D.status.value = 'current'
        and exists (
          D.content c
            where c.attachment.data is not null
              and "NoteContainsAnyPhrase"(
                ToString(c.attachment.data),
                "Hemodynamic Compromise Phrases"
              )
        )
  )

// ─── LEAF: RefractoryToIVRateControl ────────────────────────────────────────
// Searches clinical notes for IV rate control failure documentation
define "IV Rate Control Failure Phrases":
  { 'refractory to iv rate control', 'failed iv metoprolol', 'failed iv diltiazem',
    'inadequate rate control', 'persistent symptoms despite iv therapy' }

define "RefractoryToIVRateControl":
  exists (
    [DocumentReference] D
      where D.status.value = 'current'
        and exists (
          D.content c
            where c.attachment.data is not null
              and "NoteContainsAnyPhrase"(
                ToString(c.attachment.data),
                "IV Rate Control Failure Phrases"
              )
        )
  )

// ─── LEAF: AcuteDecompensatedHFWithAFib ─────────────────────────────────────
// Active acute decompensated heart failure diagnosis concurrent with AFib
define "AcuteDecompensatedHFWithAFib":
  "HasQualifyingAFibDiagnosis"
    and exists (
      [Condition] C
        where "HasCodeInSet"(C.code, "Acute HF ICD10 Codes")
          and "IsActiveCondition"(C)
    )

// ─── LEAF: PreExcitationAFibWPW ─────────────────────────────────────────────
// Active WPW or pre-excitation syndrome diagnosis with concurrent AFib
define "PreExcitationAFibWPW":
  "HasQualifyingAFibDiagnosis"
    and exists (
      [Condition] C
        where "HasCodeInSet"(C.code, "WPW ICD10 Codes")
          and "IsActiveCondition"(C)
    )

// ─── LEAF: AFibOnsetWithin48Hours ────────────────────────────────────────────
// Clinical note documents AFib onset within 48 hours of presentation
define "AFib Onset Within 48h Phrases":
  { 'onset within 48 hours', 'afib onset less than 48', 'new onset afib',
    'first detected afib', 'symptom onset within 48', 'within 48 hours of onset',
    'acute onset atrial fibrillation', 'new-onset afib', 'onset less than 48 hours' }

define "AFibOnsetWithin48Hours":
  exists (
    [DocumentReference] D
      where D.status.value = 'current'
        and exists (
          D.content c
            where c.attachment.data is not null
              and "NoteContainsAnyPhrase"(
                ToString(c.attachment.data),
                "AFib Onset Within 48h Phrases"
              )
        )
  )

// ─── LEAF: CardioversionPlannedOrPerformed ───────────────────────────────────
// Clinical note or ServiceRequest documents cardioversion plan or performance
define "Cardioversion Phrases":
  { 'cardioversion planned', 'electrical cardioversion', 'pharmacologic cardioversion',
    'rhythm control strategy', 'dccv', 'chemical cardioversion', 'direct current cardioversion' }

define "CardioversionPlannedOrPerformed":
  exists (
    [DocumentReference] D
      where D.status.value = 'current'
        and exists (
          D