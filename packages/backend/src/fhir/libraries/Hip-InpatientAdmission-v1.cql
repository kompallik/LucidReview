library Hip_InpatientAdmission_v1 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMEDCT": 'http://snomed.info/sct'
codesystem "CPT": 'http://www.ama-assn.org/go/cpt'

// ============================================================
// ICD-10-CM Codes — Hip Fracture (Initial Encounter)
// ============================================================
code "S72.001A": 'S72.001A' from "ICD10CM" display 'Fracture of unspecified part of neck of right femur, initial encounter'
code "S72.002A": 'S72.002A' from "ICD10CM" display 'Fracture of unspecified part of neck of left femur, initial encounter'
code "S72.009A": 'S72.009A' from "ICD10CM" display 'Fracture of unspecified part of neck of unspecified femur, initial encounter'
code "S72.011A": 'S72.011A' from "ICD10CM" display 'Displaced fracture of greater trochanter of right femur, initial encounter'
code "S72.012A": 'S72.012A' from "ICD10CM" display 'Displaced fracture of greater trochanter of left femur, initial encounter'
code "S72.019A": 'S72.019A' from "ICD10CM" display 'Displaced fracture of greater trochanter of unspecified femur, initial encounter'
code "S72.021A": 'S72.021A' from "ICD10CM" display 'Displaced fracture of lesser trochanter of right femur, initial encounter'
code "S72.022A": 'S72.022A' from "ICD10CM" display 'Displaced fracture of lesser trochanter of left femur, initial encounter'
code "S72.031A": 'S72.031A' from "ICD10CM" display 'Displaced oblique fracture of shaft of right femur, initial encounter'
code "S72.032A": 'S72.032A' from "ICD10CM" display 'Displaced oblique fracture of shaft of left femur, initial encounter'
code "S72.041A": 'S72.041A' from "ICD10CM" display 'Displaced spiral fracture of shaft of right femur, initial encounter'
code "S72.042A": 'S72.042A' from "ICD10CM" display 'Displaced spiral fracture of shaft of left femur, initial encounter'
code "S72.091A": 'S72.091A' from "ICD10CM" display 'Other fracture of right femur, initial encounter'
code "S72.092A": 'S72.092A' from "ICD10CM" display 'Other fracture of left femur, initial encounter'
code "S72.101A": 'S72.101A' from "ICD10CM" display 'Unspecified trochanteric fracture of right femur, initial encounter'
code "S72.102A": 'S72.102A' from "ICD10CM" display 'Unspecified trochanteric fracture of left femur, initial encounter'
code "S72.111A": 'S72.111A' from "ICD10CM" display 'Displaced fracture of greater trochanter of right femur, initial encounter for closed fracture'
code "S72.112A": 'S72.112A' from "ICD10CM" display 'Displaced fracture of greater trochanter of left femur, initial encounter for closed fracture'
code "S72.121A": 'S72.121A' from "ICD10CM" display 'Displaced intertrochanteric fracture of right femur, initial encounter'
code "S72.122A": 'S72.122A' from "ICD10CM" display 'Displaced intertrochanteric fracture of left femur, initial encounter'
code "S72.131A": 'S72.131A' from "ICD10CM" display 'Displaced subtrochanteric fracture of right femur, initial encounter'
code "S72.132A": 'S72.132A' from "ICD10CM" display 'Displaced subtrochanteric fracture of left femur, initial encounter'
code "S72.141A": 'S72.141A' from "ICD10CM" display 'Displaced fracture of base of neck of right femur, initial encounter'
code "S72.142A": 'S72.142A' from "ICD10CM" display 'Displaced fracture of base of neck of left femur, initial encounter'
code "S72.301A": 'S72.301A' from "ICD10CM" display 'Unspecified fracture of shaft of right femur, initial encounter'
code "S72.302A": 'S72.302A' from "ICD10CM" display 'Unspecified fracture of shaft of left femur, initial encounter'

// ============================================================
// ICD-10-CM Codes — Primary Hip Osteoarthritis
// ============================================================
code "M16.11": 'M16.11' from "ICD10CM" display 'Primary osteoarthritis, right hip'
code "M16.12": 'M16.12' from "ICD10CM" display 'Primary osteoarthritis, left hip'
code "M16.31": 'M16.31' from "ICD10CM" display 'Unilateral post-traumatic osteoarthritis, right hip'
code "M16.32": 'M16.32' from "ICD10CM" display 'Unilateral post-traumatic osteoarthritis, left hip'
code "M16.10": 'M16.10' from "ICD10CM" display 'Primary osteoarthritis, unspecified hip'
code "M16.30": 'M16.30' from "ICD10CM" display 'Unilateral post-traumatic osteoarthritis, unspecified hip'

// ============================================================
// ICD-10-CM Codes — OSA
// ============================================================
code "G47.33": 'G47.33' from "ICD10CM" display 'Obstructive sleep apnea (adult)(pediatric)'
code "G47.31": 'G47.31' from "ICD10CM" display 'Primary central sleep apnea'
code "G47.39": 'G47.39' from "ICD10CM" display 'Other sleep apnea'

// ============================================================
// ICD-10-CM Codes — Cardiac Disease
// ============================================================
code "I50.20": 'I50.20' from "ICD10CM" display 'Unspecified systolic (congestive) heart failure'
code "I50.21": 'I50.21' from "ICD10CM" display 'Acute systolic (congestive) heart failure'
code "I50.22": 'I50.22' from "ICD10CM" display 'Chronic systolic (congestive) heart failure'
code "I50.23": 'I50.23' from "ICD10CM" display 'Acute on chronic systolic (congestive) heart failure'
code "I50.30": 'I50.30' from "ICD10CM" display 'Unspecified diastolic (congestive) heart failure'
code "I50.31": 'I50.31' from "ICD10CM" display 'Acute diastolic (congestive) heart failure'
code "I50.32": 'I50.32' from "ICD10CM" display 'Chronic diastolic (congestive) heart failure'
code "I50.33": 'I50.33' from "ICD10CM" display 'Acute on chronic diastolic (congestive) heart failure'
code "I25.10": 'I25.10' from "ICD10CM" display 'Atherosclerotic heart disease of native coronary artery without angina pectoris'
code "I25.110": 'I25.110' from "ICD10CM" display 'Atherosclerotic heart disease of native coronary artery with unstable angina pectoris'
code "I25.700": 'I25.700' from "ICD10CM" display 'Atherosclerosis of coronary artery bypass graft(s), unspecified, with unstable angina pectoris'
code "I35.0": 'I35.0' from "ICD10CM" display 'Nonrheumatic aortic (valve) stenosis'
code "I35.1": 'I35.1' from "ICD10CM" display 'Nonrheumatic aortic (valve) insufficiency'
code "I34.0": 'I34.0' from "ICD10CM" display 'Nonrheumatic mitral (valve) insufficiency'
code "I48.0": 'I48.0' from "ICD10CM" display 'Paroxysmal atrial fibrillation'
code "I48.11": 'I48.11' from "ICD10CM" display 'Longstanding persistent atrial fibrillation'
code "I48.19": 'I48.19' from "ICD10CM" display 'Other persistent atrial fibrillation'
code "I48.20": 'I48.20' from "ICD10CM" display 'Chronic atrial fibrillation, unspecified'

// ============================================================
// ICD-10-CM Codes — Pulmonary Disease
// ============================================================
code "J44.0": 'J44.0' from "ICD10CM" display 'Chronic obstructive pulmonary disease with acute lower respiratory infection'
code "J44.1": 'J44.1' from "ICD10CM" display 'Chronic obstructive pulmonary disease with (acute) exacerbation'
code "J44.9": 'J44.9' from "ICD10CM" display 'Chronic obstructive pulmonary disease, unspecified'
code "J45.50": 'J45.50' from "ICD10CM" display 'Severe persistent asthma, uncomplicated'
code "J45.51": 'J45.51' from "ICD10CM" display 'Severe persistent asthma with (acute) exacerbation'
code "J45.901": 'J45.901' from "ICD10CM" display 'Unspecified asthma with (acute) exacerbation'
code "I27.0": 'I27.0' from "ICD10CM" display 'Primary pulmonary hypertension'
code "I27.20": 'I27.20' from "ICD10CM" display 'Pulmonary hypertension, unspecified'
code "I27.21": 'I27.21' from "ICD10CM" display 'Secondary pulmonary arterial hypertension'
code "I27.22": 'I27.22' from "ICD10CM" display 'Pulmonary hypertension due to left heart disease'
code "I27.23": 'I27.23' from "ICD10CM" display 'Pulmonary hypertension due to lung diseases and hypoxia'
code "J96.10": 'J96.10' from "ICD10CM" display 'Chronic respiratory failure, unspecified whether with hypoxia or hypercapnia'
code "J96.11": 'J96.11' from "ICD10CM" display 'Chronic respiratory failure with hypoxia'
code "J96.12": 'J96.12' from "ICD10CM" display 'Chronic respiratory failure with hypercapnia'

// ============================================================
// LOINC Codes
// ============================================================
code "INR": '6301-6' from "LOINC" display 'INR in Platelet poor plasma by Coagulation assay'
code "Sodium": '2951-2' from "LOINC" display 'Sodium [Moles/volume] in Serum or Plasma'
code "Potassium": '2823-3' from "LOINC" display 'Potassium [Moles/volume] in Serum or Plasma'
code "Glucose": '2345-7' from "LOINC" display 'Glucose [Mass/volume] in Serum or Plasma'
code "pH Arterial": '2744-1' from "LOINC" display 'pH of Arterial blood'
code "BMI": '39156-5' from "LOINC" display 'Body mass index (BMI) [Ratio]'
code "Hemoglobin": '718-7' from "LOINC" display 'Hemoglobin [Mass/volume] in Blood'
code "Hematocrit": '4544-3' from "LOINC" display 'Hematocrit [Volume Fraction] of Blood by Automated count'
code "Age Reported": '21612-7' from "LOINC" display 'Age - Reported'
code "Vital Signs Panel": '85353-1' from "LOINC" display 'Vital signs, weight, height, head circumference and oximetry panel'
code "Pain Severity NRS": '72514-3' from "LOINC" display 'Pain severity - 0-10 verbal numeric rating [Score] - Reported'

// ============================================================
// CPT Codes — THA Procedures
// ============================================================
code "CPT 27130": '27130' from "CPT" display 'Arthroplasty, acetabular and proximal femoral prosthetic replacement (total hip arthroplasty)'
code "CPT 27132": '27132' from "CPT" display 'Conversion of previous hip surgery to total hip arthroplasty'
code "CPT 27125": '27125' from "CPT" display 'Hemiarthroplasty, hip, partial (femoral head prosthesis)'
code "CPT 27236": '27236' from "CPT" display 'Open treatment of femoral neck fracture, with internal fixation or prosthetic replacement'
code "CPT 27244": '27244' from "CPT" display 'Treatment of intertrochanteric, peritrochanteric, or subtrochanteric femoral fracture; with plate/screw type implant'
code "CPT 27245": '27245' from "CPT" display 'Treatment of intertrochanteric, peritrochanteric, or subtrochanteric femoral fracture; with intramedullary implant'

// ============================================================
// Parameters
// ============================================================
parameter "Measurement Period" Interval<DateTime>
  default Interval[@2026-01-01T00:00:00.0, @2026-12-31T23:59:59.0]

parameter "Admission DateTime" DateTime
  default @2026-01-01T00:00:00.0

parameter "Surgery DateTime" DateTime
  default null

context Patient

// ============================================================
// Helper — Active Condition Check
// ============================================================
define "Active Clinical Status Codes":
  { 'active', 'recurrence', 'relapse' }

define function "IsActiveCondition"(C Condition):
  C.clinicalStatus.coding.exists(s | s.code in { 'active', 'recurrence', 'relapse' })

// ============================================================
// LEAF: HasEligibleHipDiagnosis
// Eligible Diagnosis Code Present (hip fracture OR primary OA)
// ============================================================
define "EligibleHipDiagnosisCodes":
  {
    'S72.001A', 'S72.002A', 'S72.009A',
    'S72.011A', 'S72.012A', 'S72.019A',
    'S72.021A', 'S72.022A',
    'S72.031A', 'S72.032A',
    'S72.041A', 'S72.042