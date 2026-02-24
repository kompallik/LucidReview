library UTI_InpatientAdmission_v1 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'

// ── ICD-10 Diagnosis Codes ───────────────────────────────────────────────────

code "Acute pyelonephritis": 'N10' from "ICD10CM"
code "Chronic tubulo-interstitial nephritis unspecified": 'N11.9' from "ICD10CM"
code "Reflux-associated chronic pyelonephritis": 'N12' from "ICD10CM"
code "Pyonephrosis": 'N13.6' from "ICD10CM"
code "Urinary tract infection site not specified": 'N39.0' from "ICD10CM"
code "Sepsis due to Escherichia coli": 'A41.51' from "ICD10CM"
code "Urinary calculus unspecified": 'N20.9' from "ICD10CM"

code "Hydronephrosis with ureteropelvic junction obstruction": 'N13.0' from "ICD10CM"
code "Hydronephrosis with ureteral stricture NEC": 'N13.1' from "ICD10CM"
code "Hydronephrosis with renal and ureteral calculous obstruction": 'N13.2' from "ICD10CM"
code "Calculus of ureter": 'N20.1' from "ICD10CM"
code "Calculus of kidney with calculus of ureter": 'N20.2' from "ICD10CM"

code "Renal and perinephric abscess": 'N15.1' from "ICD10CM"

code "Vesicoureteral reflux unspecified without reflux nephropathy": 'N13.70' from "ICD10CM"
code "Vesicoureteral reflux without reflux nephropathy unilateral": 'N13.71' from "ICD10CM"
code "Vesicoureteral reflux without reflux nephropathy bilateral": 'N13.72' from "ICD10CM"
code "Neuromuscular dysfunction of bladder unspecified": 'N31.9' from "ICD10CM"
code "Uninhibited neuropathic bladder NEC": 'N31.0' from "ICD10CM"
code "Reflex neuropathic bladder NEC": 'N31.1' from "ICD10CM"
code "Flaccid neuropathic bladder NEC": 'N31.2' from "ICD10CM"
code "Kidney transplant status": 'Z94.0' from "ICD10CM"

code "Kidney transplant status Z94": 'Z94.0' from "ICD10CM"
code "Heart transplant status": 'Z94.1' from "ICD10CM"
code "Lung transplant status": 'Z94.2' from "ICD10CM"
code "Heart and lung transplant status": 'Z94.3' from "ICD10CM"
code "Liver transplant status": 'Z94.4' from "ICD10CM"
code "Bone marrow transplant status": 'Z94.81' from "ICD10CM"
code "Stem cell transplant status": 'Z94.84' from "ICD10CM"

code "Human immunodeficiency virus HIV disease": 'B20' from "ICD10CM"
code "Asymptomatic human immunodeficiency virus HIV infection status": 'Z21' from "ICD10CM"

code "Diabetes mellitus type 1": 'E10' from "ICD10CM"
code "Diabetes mellitus type 1 without complications": 'E10.9' from "ICD10CM"
code "Type 2 diabetes mellitus": 'E11' from "ICD10CM"
code "Type 2 diabetes mellitus without complications": 'E11.9' from "ICD10CM"
code "Other specified diabetes mellitus": 'E13' from "ICD10CM"
code "Other specified diabetes mellitus without complications": 'E13.9' from "ICD10CM"

code "Alcoholic cirrhosis of liver without ascites": 'K70.30' from "ICD10CM"
code "Alcoholic cirrhosis of liver with ascites": 'K70.31' from "ICD10CM"
code "Alcoholic hepatic failure without coma": 'K70.40' from "ICD10CM"
code "Alcoholic hepatic failure with coma": 'K70.41' from "ICD10CM"
code "Toxic liver disease with fibrosis and cirrhosis": 'K71.7' from "ICD10CM"
code "Hepatic fibrosis": 'K74.0' from "ICD10CM"
code "Hepatic sclerosis": 'K74.1' from "ICD10CM"
code "Hepatic fibrosis with hepatic sclerosis": 'K74.2' from "ICD10CM"
code "Primary biliary cirrhosis": 'K74.3' from "ICD10CM"
code "Secondary biliary cirrhosis": 'K74.4' from "ICD10CM"
code "Biliary cirrhosis unspecified": 'K74.5' from "ICD10CM"
code "Unspecified cirrhosis of liver": 'K74.60' from "ICD10CM"
code "Other cirrhosis of liver": 'K74.69' from "ICD10CM"

code "Infection of kidney in pregnancy first trimester": 'O23.00' from "ICD10CM"
code "Infection of kidney in pregnancy first trimester O23.01": 'O23.01' from "ICD10CM"
code "Infection of kidney in pregnancy second trimester": 'O23.02' from "ICD10CM"
code "Infection of kidney in pregnancy third trimester": 'O23.03' from "ICD10CM"
code "Infections of bladder in pregnancy first trimester": 'O23.10' from "ICD10CM"
code "Infections of bladder in pregnancy unspecified trimester": 'O23.11' from "ICD10CM"
code "Infections of bladder in pregnancy second trimester": 'O23.12' from "ICD10CM"
code "Infections of bladder in pregnancy third trimester": 'O23.13' from "ICD10CM"
code "Infections of urethra in pregnancy first trimester": 'O23.20' from "ICD10CM"
code "Infections of urethra in pregnancy unspecified trimester": 'O23.21' from "ICD10CM"
code "Infections of urethra in pregnancy second trimester": 'O23.22' from "ICD10CM"
code "Infections of urethra in pregnancy third trimester": 'O23.23' from "ICD10CM"
code "Infections of other parts of urinary tract in pregnancy first trimester": 'O23.30' from "ICD10CM"
code "Infections of other parts of urinary tract in pregnancy unspecified trimester": 'O23.31' from "ICD10CM"
code "Infections of other parts of urinary tract in pregnancy second trimester": 'O23.32' from "ICD10CM"
code "Infections of other parts of urinary tract in pregnancy third trimester": 'O23.33' from "ICD10CM"
code "Unspecified genitourinary tract infection in pregnancy first trimester": 'O23.40' from "ICD10CM"
code "Unspecified genitourinary tract infection in pregnancy unspecified trimester": 'O23.41' from "ICD10CM"
code "Unspecified genitourinary tract infection in pregnancy second trimester": 'O23.42' from "ICD10CM"
code "Unspecified genitourinary tract infection in pregnancy third trimester": 'O23.43' from "ICD10CM"
code "Unspecified infection of urinary tract in pregnancy unspecified trimester": 'O23.90' from "ICD10CM"
code "Unspecified infection of urinary tract in pregnancy first trimester": 'O23.91' from "ICD10CM"
code "Unspecified infection of urinary tract in pregnancy second trimester": 'O23.92' from "ICD10CM"
code "Unspecified infection of urinary tract in pregnancy third trimester": 'O23.93' from "ICD10CM"

// ── LOINC Observation Codes ──────────────────────────────────────────────────

code "Body temperature": '8310-5' from "LOINC"
code "Systolic blood pressure": '8480-6' from "LOINC"
code "Heart rate": '8867-4' from "LOINC"
code "Glomerular filtration rate CKD-EPI": '62238-1' from "LOINC"
code "Blood culture": '600-7' from "LOINC"
code "Patient age": '21612-7' from "LOINC"

// ── Parameters ───────────────────────────────────────────────────────────────

parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

// ── Context ──────────────────────────────────────────────────────────────────

context Patient

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — QUALIFYING DIAGNOSIS LEAF EXPRESSIONS
// ════════════════════════════════════════════════════════════════════════════

define "HasAcutePyelonephritisDiagnosis":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.system = 'http://hl7.org/fhir/sid/icd-10-cm'
        and coding.code = 'N10')
        and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
  )

define "HasChronicOrObstructivePyelonephritisDiagnosis":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.system = 'http://hl7.org/fhir/sid/icd-10-cm'
        and coding.code in { 'N11.9', 'N12', 'N13.6' })
        and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
  )

define "HasUTIDiagnosis":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.system = 'http://hl7.org/fhir/sid/icd-10-cm'
        and coding.code = 'N39.0')
        and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
  )

define "HasUrosepsisDiagnosis":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.system = 'http://hl7.org/fhir/sid/icd-10-cm'
        and coding.code = 'A41.51')
        and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
  )

define "HasNephrolithiasisDiagnosis":
  exists (
    [Condition] C
      where C.code.coding.exists(coding => coding.system = 'http://hl7.org/fhir/sid/icd-10-cm'
        and coding.code = 'N20.9')
        and C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
  )

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — VITAL SIGN LEAF EXPRESSIONS
// ════════════════════════════════════════════════════════════════════════════

define "RecentTemperatureObservations":
  [Observation: "Body temperature"] O
    where O.status.value in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as FHIR.dateTime).value >= (Now() - 24 hours)

define "HasFeverGreaterThan38Point5C":
  exists (
    "RecentTemperatureObservations" O
      where (O.value as FHIR.Quantity).value > 38.5
  )

define "RecentSystolicBPObservations":
  [Observation: "Systolic blood pressure"] O
    where O.status.value in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as FHIR.dateTime).value >= (Now() - 24 hours)

define "HasHypotensionSBPLessThan90":
  exists (
    "RecentSystolicBPObservations" O
      where (O.value as FHIR.Quantity).value < 90
  )

define "RecentHeartRateObservations":
  [Observation: "Heart rate"] O
    where O.status.value in { 'final', 'amended', 'corrected' }
      and O.effective is not null
      and (O.effective as FHIR.dateTime).value >= (Now() - 24 hours)

define "HasTachycardiaHRGreaterThan100":
  exists (
    "RecentHeartRateObservations" O
      where (O.value as FHIR.Quantity).value > 100
  )

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — CLINICAL NOTE / DOCUMENTATION LEAF EXPRESSIONS
// Clinical note criteria are represented as Observations with a text-based
// value or as Conditions where the concept has been coded. When structured
// data is unavailable the expression checks for a qualifying Observation
// whose value indicates the finding is present, or falls back to a
// DocumentReference-based search for the relevant term.
// ════════════════════════════════════════════════════════════════════════════

// Chills or Rigors — look for a coded Observation or a Condition representing
// the finding within the encounter window.
define "HasChillsOrRigorsDocumented":
  exists (
    [Observation] O
      where O.status.value in { 'final', 'amended', 'corrected', 'preliminary' }
        and O.effective is not null
        and (O.effective as FHIR.dateTime).value >= (Now() - 24 hours)
        and O.code.coding.exists(c =>
          c.system = 'http://snomed.info/sct'
            and c.code in { '43724002', '274640006', '248458005' }
        )
  )
  or exists (
    [Condition] C
      where C.clinicalStatus.coding.exists(s => s.code in { 'active', 'recurrence', 'relapse' })
        and C.code.coding.exists(c =>
          c.system = 'http://snomed.info/sct'
            and c.code in { '43724002', '274640006', '248458005' }
        )
  )

// Altered Mental Status — coded Observation or Condition for acute confusion /
// delirium / decreased consciousness
define "HasAlteredMentalStatusDocumented":