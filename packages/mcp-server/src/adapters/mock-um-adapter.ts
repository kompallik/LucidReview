/**
 * Mock UM adapter returning realistic clinical data for ~105 cases across 14 series.
 *
 * Case series supported:
 *   ARF  - Acute Respiratory Failure (J96.00), Inpatient, URGENT
 *   CHF  - Heart Failure (I50.9), Inpatient, STANDARD
 *   DIA  - Type 2 Diabetes (E11.9), Outpatient, RETROSPECTIVE
 *   DME  - Bladder dysfunction (N31.9) / Osteoporosis (M80.00), DME
 *   HH   - Stroke sequelae (I69.30) / COPD (J44.9), Home Health
 *   HIP  - Hip OA (M16.11), Outpatient Surgery
 *   IP   - Inpatient multi-dx (J96.00, J44.1, A41.9, G30.9, C34.90, I21.9, K70.30, I50.9)
 *   NFDS - Diabetes Nutrition (E10.9, E11.65, E11.40), Outpatient Nutrition
 *   NS   - Nutrition Support (R63.3, K31.84), Nutrition Support
 *   OOA  - Out-of-Area multi-dx (J44.1, N18.6, A41.9, I21.9, I63.9, J18.9, I50.9, E11.9, G20, J96.00)
 *   OP   - Outpatient Surgery (N40.1, M17.11, M16.11, C18.9)
 *   SKN  - Cellulitis (L03.211), Outpatient
 *   SNF  - COPD Skilled Nursing (J44.9)
 *   TX   - Transplant (K74.60, C22.0, I50.9, N18.6, Z94.0), Inpatient
 *
 * Selected when UM_SYSTEM_BASE_URL starts with "http://mock" or is unset.
 */

import type {
  UmCaseData,
  UmClinicalData,
  UmAttachment,
  UmCoverageData,
  UmHistoryEntry,
  UmCaseNote,
} from '@lucidreview/shared';

// ---------------------------------------------------------------------------
// Time helpers (static offsets from call time)
// ---------------------------------------------------------------------------
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Deterministic hash – maps a case-number string to a stable integer
// ---------------------------------------------------------------------------
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ---------------------------------------------------------------------------
// Demographic pools used to generate unique-but-deterministic patients
// ---------------------------------------------------------------------------
const FIRST_NAMES_MALE = [
  'James', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas',
  'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Paul', 'Steven',
  'Andrew', 'Kenneth', 'George', 'Joshua',
];
const FIRST_NAMES_FEMALE = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Susan', 'Jessica', 'Karen',
  'Sarah', 'Lisa', 'Nancy', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol',
  'Ruth', 'Sharon', 'Michelle', 'Laura',
];
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];
const BIRTH_YEARS = [1942, 1945, 1948, 1950, 1952, 1955, 1957, 1958, 1960, 1963, 1965, 1968, 1970, 1972];
const BIRTH_MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const BIRTH_DAYS = ['05', '10', '14', '18', '21', '25', '28'];

function pickFrom<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function generatePatient(caseNumber: string): UmCaseData['patient'] {
  const h = hashCode(caseNumber);
  const genderSeed = h % 3;
  const gender: 'male' | 'female' = genderSeed < 2 ? 'male' : 'female';
  const firstName =
    gender === 'male'
      ? pickFrom(FIRST_NAMES_MALE, h)
      : pickFrom(FIRST_NAMES_FEMALE, (h >> 2));
  const lastName = pickFrom(LAST_NAMES, (h >> 3));
  const year = pickFrom(BIRTH_YEARS, (h >> 5));
  const month = pickFrom(BIRTH_MONTHS, (h >> 7));
  const day = pickFrom(BIRTH_DAYS, (h >> 9));
  const mrnNum = 100000 + (h % 900000);
  const mbrNum = 100000 + ((h >> 4) % 900000);
  return {
    id: `PAT-${caseNumber}`,
    firstName,
    lastName,
    dateOfBirth: `${year}-${month}-${day}`,
    gender,
    mrn: `MRN-${mrnNum}`,
    // memberId is exposed on UmCaseData directly; we attach mbrNum for use below
    _memberId: `MBR-${mbrNum}`,
  } as UmCaseData['patient'] & { _memberId: string };
}

// ---------------------------------------------------------------------------
// Series metadata lookup
// ---------------------------------------------------------------------------
interface SeriesMeta {
  serviceType: string;
  urgency: 'URGENT' | 'STANDARD' | 'RETROSPECTIVE';
  specialty: string;
  facilityName: string;
  providerName: string;
  providerNpi: string;
  facilityNpi: string;
}

const SERIES_META: Record<string, SeriesMeta> = {
  ARF: {
    serviceType: 'Inpatient Admission',
    urgency: 'URGENT',
    specialty: 'Emergency Medicine',
    facilityName: 'City General Hospital',
    providerName: 'Dr. Sarah Chen',
    providerNpi: '1234567890',
    facilityNpi: '9876543210',
  },
  CHF: {
    serviceType: 'Inpatient Admission',
    urgency: 'STANDARD',
    specialty: 'Cardiology',
    facilityName: 'Regional Heart Center',
    providerName: 'Dr. Michael Torres',
    providerNpi: '2345678901',
    facilityNpi: '8765432101',
  },
  DIA: {
    serviceType: 'Outpatient',
    urgency: 'RETROSPECTIVE',
    specialty: 'Endocrinology',
    facilityName: 'Metro Diabetes Clinic',
    providerName: 'Dr. Angela Park',
    providerNpi: '3456789012',
    facilityNpi: '7654321012',
  },
  DME: {
    serviceType: 'Durable Medical Equipment',
    urgency: 'STANDARD',
    specialty: 'Urology / Orthopedics',
    facilityName: 'Community Medical Supply',
    providerName: 'Dr. Robert Nguyen',
    providerNpi: '4567890123',
    facilityNpi: '6543210123',
  },
  HH: {
    serviceType: 'Home Health',
    urgency: 'STANDARD',
    specialty: 'Physical Medicine & Rehabilitation',
    facilityName: 'Valley Home Health Agency',
    providerName: 'Dr. Linda Vasquez',
    providerNpi: '5678901234',
    facilityNpi: '5432101234',
  },
  HIP: {
    serviceType: 'Outpatient Surgery',
    urgency: 'STANDARD',
    specialty: 'Orthopedic Surgery',
    facilityName: 'Orthopaedic Surgery Center',
    providerName: 'Dr. James Okafor',
    providerNpi: '6789012345',
    facilityNpi: '4321012345',
  },
  IP: {
    serviceType: 'Inpatient Admission',
    urgency: 'URGENT',
    specialty: 'Internal Medicine / Hospitalist',
    facilityName: 'University Medical Center',
    providerName: 'Dr. Priya Kapoor',
    providerNpi: '7890123456',
    facilityNpi: '3210123456',
  },
  NFDS: {
    serviceType: 'Outpatient Nutrition Services',
    urgency: 'STANDARD',
    specialty: 'Nutrition / Dietetics',
    facilityName: 'Diabetes Nutrition Clinic',
    providerName: 'Dr. Karen Mills',
    providerNpi: '8901234567',
    facilityNpi: '2101234567',
  },
  NS: {
    serviceType: 'Nutrition Support',
    urgency: 'STANDARD',
    specialty: 'Gastroenterology / Nutrition Support',
    facilityName: 'Gastroenterology Associates',
    providerName: 'Dr. Brian Fowler',
    providerNpi: '9012345678',
    facilityNpi: '1012345678',
  },
  OOA: {
    serviceType: 'Out-of-Area Inpatient',
    urgency: 'URGENT',
    specialty: 'Internal Medicine',
    facilityName: 'Sunstate Regional Hospital',
    providerName: 'Dr. Elena Romero',
    providerNpi: '0123456789',
    facilityNpi: '0987654321',
  },
  OP: {
    serviceType: 'Outpatient Surgery',
    urgency: 'STANDARD',
    specialty: 'General / Urologic Surgery',
    facilityName: 'Ambulatory Surgery Center',
    providerName: 'Dr. Nathan Yee',
    providerNpi: '1122334455',
    facilityNpi: '5544332211',
  },
  SKN: {
    serviceType: 'Outpatient',
    urgency: 'STANDARD',
    specialty: 'Infectious Disease',
    facilityName: 'Outpatient Infusion Center',
    providerName: 'Dr. Olivia Scott',
    providerNpi: '2233445566',
    facilityNpi: '6655443322',
  },
  SNF: {
    serviceType: 'Skilled Nursing Facility',
    urgency: 'STANDARD',
    specialty: 'Pulmonology',
    facilityName: 'Sunrise Skilled Nursing Facility',
    providerName: 'Dr. Harold Kim',
    providerNpi: '3344556677',
    facilityNpi: '7766554433',
  },
  TX: {
    serviceType: 'Inpatient Transplant',
    urgency: 'URGENT',
    specialty: 'Transplant Hepatology',
    facilityName: 'Transplant Institute at Memorial',
    providerName: 'Dr. Sophia Delacroix',
    providerNpi: '4455667788',
    facilityNpi: '8877665544',
  },
};

// ---------------------------------------------------------------------------
// ICD-10-keyed diagnosis / procedure tables
// ---------------------------------------------------------------------------
interface DiagnosisRow {
  code: string;
  codeSystem: 'ICD-10-CM' | 'ICD-10-PCS';
  description: string;
  type: 'PRIMARY' | 'SECONDARY' | 'ADMITTING';
}
interface ProcedureRow {
  code: string;
  codeSystem: 'CPT' | 'HCPCS' | 'ICD-10-PCS';
  description: string;
}

interface ClinicalTemplate {
  diagnoses: DiagnosisRow[];
  procedures: ProcedureRow[];
  vitals: Array<{ type: string; value: number; unit: string }>;
  labs: Array<{ name: string; value: number; unit: string; loincCode: string }>;
}

const CLINICAL_TEMPLATES: Record<string, ClinicalTemplate> = {
  ARF: {
    diagnoses: [
      { code: 'J96.00', codeSystem: 'ICD-10-CM', description: 'Acute respiratory failure, unspecified whether with hypoxia or hypercapnia', type: 'PRIMARY' },
      { code: 'J44.1', codeSystem: 'ICD-10-CM', description: 'Chronic obstructive pulmonary disease with (acute) exacerbation', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '94660', codeSystem: 'CPT', description: 'Continuous positive airway pressure ventilation (CPAP)/BiPAP' },
      { code: '94005', codeSystem: 'CPT', description: 'Home ventilator management, supervision' },
    ],
    vitals: [
      { type: 'SpO2', value: 87, unit: '%' },
      { type: 'Respiratory Rate', value: 28, unit: 'breaths/min' },
      { type: 'Heart Rate', value: 110, unit: 'bpm' },
      { type: 'Temperature', value: 38.2, unit: '°C' },
      { type: 'Blood Pressure Systolic', value: 148, unit: 'mmHg' },
      { type: 'Blood Pressure Diastolic', value: 92, unit: 'mmHg' },
    ],
    labs: [
      { name: 'pO2', value: 55, unit: 'mmHg', loincCode: '2703-7' },
      { name: 'pCO2', value: 52, unit: 'mmHg', loincCode: '2019-8' },
      { name: 'pH', value: 7.31, unit: '', loincCode: '2744-1' },
      { name: 'WBC', value: 14.2, unit: '10^3/uL', loincCode: '6690-2' },
      { name: 'Lactate', value: 2.8, unit: 'mmol/L', loincCode: '2524-7' },
    ],
  },

  CHF: {
    diagnoses: [
      { code: 'I50.9', codeSystem: 'ICD-10-CM', description: 'Heart failure, unspecified', type: 'PRIMARY' },
      { code: 'I11.0', codeSystem: 'ICD-10-CM', description: 'Hypertensive heart disease with heart failure', type: 'SECONDARY' },
      { code: 'N18.3', codeSystem: 'ICD-10-CM', description: 'Chronic kidney disease, stage 3 (moderate)', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '93306', codeSystem: 'CPT', description: 'Echocardiography, transthoracic' },
      { code: '93000', codeSystem: 'CPT', description: 'Electrocardiogram, routine' },
    ],
    vitals: [
      { type: 'SpO2', value: 91, unit: '%' },
      { type: 'Heart Rate', value: 104, unit: 'bpm' },
      { type: 'Blood Pressure Systolic', value: 162, unit: 'mmHg' },
      { type: 'Blood Pressure Diastolic', value: 98, unit: 'mmHg' },
      { type: 'Respiratory Rate', value: 24, unit: 'breaths/min' },
      { type: 'Weight', value: 92, unit: 'kg' },
    ],
    labs: [
      { name: 'BNP', value: 1240, unit: 'pg/mL', loincCode: '42637-9' },
      { name: 'Creatinine', value: 1.8, unit: 'mg/dL', loincCode: '2160-0' },
      { name: 'Sodium', value: 131, unit: 'mEq/L', loincCode: '2951-2' },
      { name: 'Troponin I', value: 0.04, unit: 'ng/mL', loincCode: '10839-9' },
      { name: 'LVEF (Echo)', value: 25, unit: '%', loincCode: '10230-1' },
    ],
  },

  DIA: {
    diagnoses: [
      { code: 'E11.9', codeSystem: 'ICD-10-CM', description: 'Type 2 diabetes mellitus without complications', type: 'PRIMARY' },
      { code: 'E11.65', codeSystem: 'ICD-10-CM', description: 'Type 2 diabetes mellitus with hyperglycemia', type: 'SECONDARY' },
      { code: 'E78.5', codeSystem: 'ICD-10-CM', description: 'Hyperlipidemia, unspecified', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '83036', codeSystem: 'CPT', description: 'Hemoglobin A1C' },
      { code: '99213', codeSystem: 'CPT', description: 'Office visit, established patient, moderate complexity' },
    ],
    vitals: [
      { type: 'Blood Glucose', value: 420, unit: 'mg/dL' },
      { type: 'Blood Pressure Systolic', value: 144, unit: 'mmHg' },
      { type: 'Blood Pressure Diastolic', value: 88, unit: 'mmHg' },
      { type: 'Weight', value: 98, unit: 'kg' },
      { type: 'BMI', value: 33.2, unit: 'kg/m²' },
    ],
    labs: [
      { name: 'HbA1c', value: 13.5, unit: '%', loincCode: '4548-4' },
      { name: 'Fasting Glucose', value: 420, unit: 'mg/dL', loincCode: '1558-6' },
      { name: 'Creatinine', value: 1.1, unit: 'mg/dL', loincCode: '2160-0' },
      { name: 'LDL', value: 148, unit: 'mg/dL', loincCode: '18262-6' },
      { name: 'eGFR', value: 62, unit: 'mL/min/1.73m²', loincCode: '62238-1' },
    ],
  },

  DME: {
    diagnoses: [
      { code: 'N31.9', codeSystem: 'ICD-10-CM', description: 'Neuromuscular dysfunction of bladder, unspecified', type: 'PRIMARY' },
      { code: 'M80.00', codeSystem: 'ICD-10-CM', description: 'Age-related osteoporosis with current pathological fracture, unspecified site', type: 'SECONDARY' },
      { code: 'Z87.39', codeSystem: 'ICD-10-CM', description: 'Personal history of other musculoskeletal disorders', type: 'SECONDARY' },
    ],
    procedures: [
      { code: 'A4351', codeSystem: 'HCPCS', description: 'Intermittent urinary catheter, straight tip, with or without coating' },
      { code: 'L1832', codeSystem: 'HCPCS', description: 'Knee orthosis, adjustable flexion/extension control' },
    ],
    vitals: [
      { type: 'Blood Pressure Systolic', value: 138, unit: 'mmHg' },
      { type: 'Blood Pressure Diastolic', value: 82, unit: 'mmHg' },
      { type: 'Heart Rate', value: 76, unit: 'bpm' },
    ],
    labs: [
      { name: 'Post-Void Residual', value: 280, unit: 'mL', loincCode: '11218-3' },
      { name: 'Creatinine', value: 1.2, unit: 'mg/dL', loincCode: '2160-0' },
      { name: 'DEXA T-score (Lumbar)', value: -3.2, unit: 'SD', loincCode: '38265-5' },
      { name: 'Vitamin D 25-OH', value: 14, unit: 'ng/mL', loincCode: '35365-6' },
    ],
  },

  HH: {
    diagnoses: [
      { code: 'I69.30', codeSystem: 'ICD-10-CM', description: 'Unspecified sequelae of cerebral infarction', type: 'PRIMARY' },
      { code: 'J44.9', codeSystem: 'ICD-10-CM', description: 'Chronic obstructive pulmonary disease, unspecified', type: 'SECONDARY' },
      { code: 'R26.1', codeSystem: 'ICD-10-CM', description: 'Paralytic gait', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '97110', codeSystem: 'CPT', description: 'Therapeutic exercise' },
      { code: '97530', codeSystem: 'CPT', description: 'Therapeutic activities, direct patient contact' },
      { code: 'G0151', codeSystem: 'HCPCS', description: 'Services of physical therapist in home health' },
    ],
    vitals: [
      { type: 'SpO2', value: 92, unit: '%' },
      { type: 'Blood Pressure Systolic', value: 152, unit: 'mmHg' },
      { type: 'Blood Pressure Diastolic', value: 94, unit: 'mmHg' },
      { type: 'Heart Rate', value: 82, unit: 'bpm' },
    ],
    labs: [
      { name: 'Barthel Index', value: 35, unit: 'score', loincCode: '96842-5' },
      { name: 'FEV1', value: 48, unit: '% predicted', loincCode: '20150-9' },
      { name: 'Creatinine', value: 1.0, unit: 'mg/dL', loincCode: '2160-0' },
    ],
  },

  HIP: {
    diagnoses: [
      { code: 'M16.11', codeSystem: 'ICD-10-CM', description: 'Unilateral primary osteoarthritis, right hip', type: 'PRIMARY' },
      { code: 'M25.551', codeSystem: 'ICD-10-CM', description: 'Pain in right hip', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '27130', codeSystem: 'CPT', description: 'Arthroplasty, acetabular and proximal femoral prosthetic replacement (total hip arthroplasty)' },
      { code: '97110', codeSystem: 'CPT', description: 'Pre-operative therapeutic exercise' },
    ],
    vitals: [
      { type: 'Blood Pressure Systolic', value: 136, unit: 'mmHg' },
      { type: 'Blood Pressure Diastolic', value: 80, unit: 'mmHg' },
      { type: 'Heart Rate', value: 74, unit: 'bpm' },
      { type: 'Pain Score', value: 8, unit: '/10' },
    ],
    labs: [
      { name: 'Kellgren-Lawrence Grade (X-ray)', value: 4, unit: 'grade', loincCode: '24648-8' },
      { name: 'Hemoglobin', value: 12.8, unit: 'g/dL', loincCode: '718-7' },
      { name: 'INR', value: 1.0, unit: '', loincCode: '6301-6' },
      { name: 'Creatinine', value: 0.9, unit: 'mg/dL', loincCode: '2160-0' },
    ],
  },

  IP: {
    diagnoses: [
      { code: 'J96.00', codeSystem: 'ICD-10-CM', description: 'Acute respiratory failure, unspecified', type: 'PRIMARY' },
      { code: 'J44.1', codeSystem: 'ICD-10-CM', description: 'COPD with acute exacerbation', type: 'SECONDARY' },
      { code: 'A41.9', codeSystem: 'ICD-10-CM', description: 'Sepsis, unspecified organism', type: 'SECONDARY' },
      { code: 'I50.9', codeSystem: 'ICD-10-CM', description: 'Heart failure, unspecified', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '94002', codeSystem: 'CPT', description: 'Ventilation management, inpatient' },
      { code: '71046', codeSystem: 'CPT', description: 'Radiologic exam, chest; 2 views' },
    ],
    vitals: [
      { type: 'SpO2', value: 87, unit: '%' },
      { type: 'Respiratory Rate', value: 30, unit: 'breaths/min' },
      { type: 'Heart Rate', value: 118, unit: 'bpm' },
      { type: 'Temperature', value: 39.1, unit: '°C' },
      { type: 'Blood Pressure Systolic', value: 88, unit: 'mmHg' },
    ],
    labs: [
      { name: 'WBC', value: 20.4, unit: '10^3/uL', loincCode: '6690-2' },
      { name: 'Lactate', value: 3.8, unit: 'mmol/L', loincCode: '2524-7' },
      { name: 'pO2', value: 52, unit: 'mmHg', loincCode: '2703-7' },
      { name: 'pH', value: 7.28, unit: '', loincCode: '2744-1' },
      { name: 'BNP', value: 980, unit: 'pg/mL', loincCode: '42637-9' },
      { name: 'Procalcitonin', value: 8.4, unit: 'ng/mL', loincCode: '75241-0' },
    ],
  },

  NFDS: {
    diagnoses: [
      { code: 'E10.9', codeSystem: 'ICD-10-CM', description: 'Type 1 diabetes mellitus without complications', type: 'PRIMARY' },
      { code: 'E11.65', codeSystem: 'ICD-10-CM', description: 'Type 2 diabetes mellitus with hyperglycemia', type: 'SECONDARY' },
      { code: 'E11.40', codeSystem: 'ICD-10-CM', description: 'Type 2 diabetes mellitus with diabetic neuropathy, unspecified', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '97802', codeSystem: 'CPT', description: 'Medical nutrition therapy, individual, assessment and intervention' },
      { code: '83036', codeSystem: 'CPT', description: 'Hemoglobin A1C' },
    ],
    vitals: [
      { type: 'Blood Glucose (fasting)', value: 380, unit: 'mg/dL' },
      { type: 'Weight', value: 104, unit: 'kg' },
      { type: 'BMI', value: 35.8, unit: 'kg/m²' },
      { type: 'Blood Pressure Systolic', value: 146, unit: 'mmHg' },
    ],
    labs: [
      { name: 'HbA1c', value: 13.5, unit: '%', loincCode: '4548-4' },
      { name: 'Fasting Glucose', value: 380, unit: 'mg/dL', loincCode: '1558-6' },
      { name: 'C-Peptide', value: 0.2, unit: 'ng/mL', loincCode: '1987-7' },
      { name: 'Urine Albumin-Creatinine Ratio', value: 380, unit: 'mg/g', loincCode: '13705-9' },
    ],
  },

  NS: {
    diagnoses: [
      { code: 'R63.3', codeSystem: 'ICD-10-CM', description: 'Feeding difficulties', type: 'PRIMARY' },
      { code: 'K31.84', codeSystem: 'ICD-10-CM', description: 'Gastroparesis', type: 'SECONDARY' },
      { code: 'E43', codeSystem: 'ICD-10-CM', description: 'Unspecified severe protein-calorie malnutrition', type: 'SECONDARY' },
    ],
    procedures: [
      { code: 'B4150', codeSystem: 'HCPCS', description: 'Enteral formula, for use in infusion pump, soy-based' },
      { code: '43246', codeSystem: 'CPT', description: 'Esophagogastroduodenoscopy with percutaneous endoscopic gastrostomy (PEG)' },
    ],
    vitals: [
      { type: 'Weight', value: 51, unit: 'kg' },
      { type: 'BMI', value: 17.4, unit: 'kg/m²' },
      { type: 'Heart Rate', value: 96, unit: 'bpm' },
      { type: 'Blood Pressure Systolic', value: 102, unit: 'mmHg' },
    ],
    labs: [
      { name: 'Albumin', value: 2.2, unit: 'g/dL', loincCode: '1751-7' },
      { name: 'Pre-albumin', value: 10, unit: 'mg/dL', loincCode: '2760-7' },
      { name: 'Weight Loss (% in 6 months)', value: 18, unit: '%', loincCode: '29463-7' },
      { name: 'Gastric Emptying T1/2 (min)', value: 248, unit: 'min', loincCode: '30005-7' },
      { name: 'Hemoglobin', value: 9.8, unit: 'g/dL', loincCode: '718-7' },
    ],
  },

  OOA: {
    diagnoses: [
      { code: 'J44.1', codeSystem: 'ICD-10-CM', description: 'COPD with acute exacerbation', type: 'PRIMARY' },
      { code: 'N18.6', codeSystem: 'ICD-10-CM', description: 'End-stage renal disease', type: 'SECONDARY' },
      { code: 'A41.9', codeSystem: 'ICD-10-CM', description: 'Sepsis, unspecified organism', type: 'SECONDARY' },
      { code: 'I50.9', codeSystem: 'ICD-10-CM', description: 'Heart failure, unspecified', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '94660', codeSystem: 'CPT', description: 'BiPAP ventilation initiation' },
      { code: '90935', codeSystem: 'CPT', description: 'Hemodialysis procedure with single physician evaluation' },
    ],
    vitals: [
      { type: 'SpO2', value: 88, unit: '%' },
      { type: 'Respiratory Rate', value: 26, unit: 'breaths/min' },
      { type: 'Heart Rate', value: 112, unit: 'bpm' },
      { type: 'Temperature', value: 38.8, unit: '°C' },
      { type: 'Blood Pressure Systolic', value: 92, unit: 'mmHg' },
    ],
    labs: [
      { name: 'Creatinine', value: 8.4, unit: 'mg/dL', loincCode: '2160-0' },
      { name: 'BUN', value: 78, unit: 'mg/dL', loincCode: '3094-0' },
      { name: 'eGFR', value: 8, unit: 'mL/min/1.73m²', loincCode: '62238-1' },
      { name: 'WBC', value: 18.2, unit: '10^3/uL', loincCode: '6690-2' },
      { name: 'Lactate', value: 4.2, unit: 'mmol/L', loincCode: '2524-7' },
      { name: 'Potassium', value: 6.1, unit: 'mEq/L', loincCode: '2823-3' },
    ],
  },

  OP: {
    diagnoses: [
      { code: 'N40.1', codeSystem: 'ICD-10-CM', description: 'Benign prostatic hyperplasia with lower urinary tract symptoms', type: 'PRIMARY' },
      { code: 'M17.11', codeSystem: 'ICD-10-CM', description: 'Unilateral primary osteoarthritis, right knee', type: 'SECONDARY' },
      { code: 'M16.11', codeSystem: 'ICD-10-CM', description: 'Unilateral primary osteoarthritis, right hip', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '52601', codeSystem: 'CPT', description: 'Transurethral resection of prostate (TURP)' },
      { code: '27447', codeSystem: 'CPT', description: 'Total knee arthroplasty' },
    ],
    vitals: [
      { type: 'Blood Pressure Systolic', value: 140, unit: 'mmHg' },
      { type: 'Blood Pressure Diastolic', value: 86, unit: 'mmHg' },
      { type: 'Heart Rate', value: 78, unit: 'bpm' },
      { type: 'Pain Score', value: 7, unit: '/10' },
    ],
    labs: [
      { name: 'PSA', value: 8.2, unit: 'ng/mL', loincCode: '2857-1' },
      { name: 'IPSS Score', value: 24, unit: 'score', loincCode: '80976-4' },
      { name: 'Post-Void Residual', value: 320, unit: 'mL', loincCode: '11218-3' },
      { name: 'Hemoglobin', value: 13.2, unit: 'g/dL', loincCode: '718-7' },
      { name: 'Creatinine', value: 1.3, unit: 'mg/dL', loincCode: '2160-0' },
    ],
  },

  SKN: {
    diagnoses: [
      { code: 'L03.211', codeSystem: 'ICD-10-CM', description: 'Cellulitis of face', type: 'PRIMARY' },
      { code: 'L03.90', codeSystem: 'ICD-10-CM', description: 'Cellulitis, unspecified', type: 'SECONDARY' },
      { code: 'E11.9', codeSystem: 'ICD-10-CM', description: 'Type 2 diabetes mellitus without complications', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '96365', codeSystem: 'CPT', description: 'Intravenous infusion, therapy/prophylaxis/diagnosis, initial up to 1 hour' },
      { code: '87070', codeSystem: 'CPT', description: 'Culture, bacterial; any other source except urine/blood' },
    ],
    vitals: [
      { type: 'Temperature', value: 38.9, unit: '°C' },
      { type: 'Heart Rate', value: 106, unit: 'bpm' },
      { type: 'Respiratory Rate', value: 20, unit: 'breaths/min' },
      { type: 'Blood Pressure Systolic', value: 112, unit: 'mmHg' },
    ],
    labs: [
      { name: 'WBC', value: 16.8, unit: '10^3/uL', loincCode: '6690-2' },
      { name: 'CRP', value: 142, unit: 'mg/L', loincCode: '1988-5' },
      { name: 'ESR', value: 88, unit: 'mm/hr', loincCode: '30341-6' },
      { name: 'Blood Glucose', value: 280, unit: 'mg/dL', loincCode: '2345-7' },
      { name: 'Erythema Diameter', value: 12, unit: 'cm', loincCode: '72168-5' },
    ],
  },

  SNF: {
    diagnoses: [
      { code: 'J44.9', codeSystem: 'ICD-10-CM', description: 'Chronic obstructive pulmonary disease, unspecified', type: 'PRIMARY' },
      { code: 'Z87.891', codeSystem: 'ICD-10-CM', description: 'Personal history of nicotine dependence', type: 'SECONDARY' },
      { code: 'R06.09', codeSystem: 'ICD-10-CM', description: 'Other forms of dyspnea', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '94760', codeSystem: 'CPT', description: 'Noninvasive ear or pulse oximetry for oxygen saturation, single determination' },
      { code: 'G0316', codeSystem: 'HCPCS', description: 'Prolonged nursing facility evaluation and management service' },
    ],
    vitals: [
      { type: 'SpO2', value: 90, unit: '%' },
      { type: 'Respiratory Rate', value: 22, unit: 'breaths/min' },
      { type: 'Heart Rate', value: 88, unit: 'bpm' },
      { type: 'Temperature', value: 37.4, unit: '°C' },
    ],
    labs: [
      { name: 'FEV1', value: 42, unit: '% predicted', loincCode: '20150-9' },
      { name: 'FEV1/FVC Ratio', value: 0.58, unit: '', loincCode: '19926-5' },
      { name: 'WBC', value: 11.8, unit: '10^3/uL', loincCode: '6690-2' },
      { name: 'Hemoglobin', value: 11.4, unit: 'g/dL', loincCode: '718-7' },
    ],
  },

  TX: {
    diagnoses: [
      { code: 'K74.60', codeSystem: 'ICD-10-CM', description: 'Unspecified cirrhosis of liver', type: 'PRIMARY' },
      { code: 'C22.0', codeSystem: 'ICD-10-CM', description: 'Liver cell carcinoma', type: 'SECONDARY' },
      { code: 'N18.6', codeSystem: 'ICD-10-CM', description: 'End-stage renal disease', type: 'SECONDARY' },
      { code: 'Z94.0', codeSystem: 'ICD-10-CM', description: 'Kidney transplant status', type: 'SECONDARY' },
    ],
    procedures: [
      { code: '47135', codeSystem: 'CPT', description: 'Liver allotransplantation; orthotopic, partial or whole' },
      { code: '76700', codeSystem: 'CPT', description: 'Ultrasound, abdominal, real time with image documentation, complete' },
    ],
    vitals: [
      { type: 'Blood Pressure Systolic', value: 118, unit: 'mmHg' },
      { type: 'Blood Pressure Diastolic', value: 72, unit: 'mmHg' },
      { type: 'Heart Rate', value: 88, unit: 'bpm' },
      { type: 'Temperature', value: 37.8, unit: '°C' },
      { type: 'Abdominal Girth', value: 98, unit: 'cm' },
    ],
    labs: [
      { name: 'MELD Score', value: 28, unit: 'score', loincCode: '80768-5' },
      { name: 'AFP (Alpha-fetoprotein)', value: 1800, unit: 'ng/mL', loincCode: '1834-1' },
      { name: 'Bilirubin Total', value: 4.2, unit: 'mg/dL', loincCode: '1975-2' },
      { name: 'INR', value: 1.9, unit: '', loincCode: '6301-6' },
      { name: 'Creatinine', value: 2.1, unit: 'mg/dL', loincCode: '2160-0' },
      { name: 'Albumin', value: 2.6, unit: 'g/dL', loincCode: '1751-7' },
      { name: 'Ascites Volume (US)', value: 2400, unit: 'mL', loincCode: '79361-8' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Physician note generators – one per series
// ---------------------------------------------------------------------------
interface NoteContext {
  patient: { firstName: string; lastName: string; dateOfBirth: string; mrn: string };
  caseNumber: string;
  provider: string;
  dos: string;
}

type NoteGenerator = (ctx: NoteContext) => string;

const NOTE_GENERATORS: Record<string, NoteGenerator> = {
  ARF: (ctx) => `EMERGENCY DEPARTMENT PHYSICIAN NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Attending: ${ctx.provider}, MD - Emergency Medicine
Case Number: ${ctx.caseNumber}

CHIEF COMPLAINT: Acute shortness of breath, worsening over 6 hours

HISTORY OF PRESENT ILLNESS:
Patient with known history of COPD presents to the ED with acute onset dyspnea. Progressive shortness of
breath over 6 hours, worsening despite home nebulizer treatments. Increased sputum production with
yellow-green sputum. Compliant with tiotropium and albuterol PRN.

PHYSICAL EXAMINATION:
- General: Alert, oriented, in moderate respiratory distress, using accessory muscles
- Vitals: T 38.2°C, HR 110, RR 28, BP 148/92, SpO2 87% on room air (Observation/spo2-${ctx.caseNumber})
- Lungs: Diffuse bilateral wheezing, prolonged expiratory phase, decreased breath sounds at bases

DIAGNOSTIC RESULTS:
- ABG: pH 7.31 (Observation/ph-${ctx.caseNumber}), pCO2 52 mmHg (Observation/pco2-${ctx.caseNumber}),
  pO2 55 mmHg (Observation/po2-${ctx.caseNumber}), O2 Sat 87%
- CXR: Hyperinflated lungs, no focal consolidation
- WBC 14.2 10^3/uL (Observation/wbc-${ctx.caseNumber}) — mild leukocytosis
- Lactate 2.8 mmol/L (Observation/lactate-${ctx.caseNumber})

ASSESSMENT/PLAN:
1. Acute respiratory failure (J96.00) secondary to COPD exacerbation (J44.1)
2. Hypoxemic and hypercapnic respiratory failure — SpO2 87% meets InterQual criteria for inpatient admission
3. Started on BiPAP, IV methylprednisolone, nebulized bronchodilators
4. Inpatient admission medically necessary; outpatient management unsafe given severity

Electronically signed by: ${ctx.provider}, MD`,

  CHF: (ctx) => `CARDIOLOGY INPATIENT ADMISSION NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Attending: ${ctx.provider}, MD - Cardiology
Case Number: ${ctx.caseNumber}

CHIEF COMPLAINT: Progressive dyspnea, bilateral leg swelling, 5 kg weight gain over 3 days

HISTORY OF PRESENT ILLNESS:
Patient with known systolic heart failure (EF 25%) presents with acute decompensation. Reports 5 kg
weight gain over 3 days, 2-pillow orthopnea, and paroxysmal nocturnal dyspnea. SpO2 91% on room air
(Observation/spo2-${ctx.caseNumber}). Unable to ambulate due to dyspnea.

PHYSICAL EXAMINATION:
- Vitals: HR 104, BP 162/98, RR 24, SpO2 91% on RA
- JVD elevated to 14 cm
- S3 gallop auscultated
- 3+ pitting edema bilateral lower extremities to knees
- Bibasilar crackles

DIAGNOSTIC RESULTS:
- BNP 1240 pg/mL (Observation/bnp-${ctx.caseNumber}) — severely elevated
- LVEF 25% on echo (Observation/ef-${ctx.caseNumber}) — severely reduced
- Creatinine 1.8 mg/dL (Observation/creatinine-${ctx.caseNumber}) — cardiorenal syndrome
- Sodium 131 mEq/L — dilutional hyponatremia
- CXR: Pulmonary vascular congestion, bilateral pleural effusions

ASSESSMENT/PLAN:
1. Acute decompensated heart failure (I50.9) with preserved and reduced ejection fraction (EF 25%)
2. BNP 1240 and LVEF 25% confirm medical necessity for inpatient IV diuresis
3. IV furosemide infusion, telemetry monitoring, fluid restriction
4. Cardiology consult for device evaluation (ICD/CRT consideration)

Electronically signed by: ${ctx.provider}, MD`,

  DIA: (ctx) => `ENDOCRINOLOGY OUTPATIENT CLINIC NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Attending: ${ctx.provider}, MD - Endocrinology
Case Number: ${ctx.caseNumber}

CHIEF COMPLAINT: Poorly controlled type 2 diabetes, A1C 13.5%

HISTORY OF PRESENT ILLNESS:
Patient presents for retrospective review of diabetes management. HbA1c 13.5% (Observation/a1c-${ctx.caseNumber})
with fasting glucose 420 mg/dL (Observation/glucose-${ctx.caseNumber}). Patient reports polyuria, polydipsia,
and 10-pound weight loss over 2 months. DKA risk is elevated; does not currently meet criteria but requires
urgent insulin titration and nutritional counseling.

PHYSICAL EXAMINATION:
- Weight 98 kg, BMI 33.2 kg/m²
- BP 144/88 mmHg — uncontrolled hypertension
- Mild peripheral neuropathy on monofilament testing

DIAGNOSTIC RESULTS:
- HbA1c 13.5% (Observation/a1c-${ctx.caseNumber})
- Fasting glucose 420 mg/dL (Observation/glucose-${ctx.caseNumber})
- LDL 148 mg/dL — above goal
- eGFR 62 — early CKD stage 2

ASSESSMENT/PLAN:
1. Type 2 DM without complications (E11.9) with hyperglycemia (E11.65)
2. Intensify insulin regimen; add GLP-1 agonist; refer to diabetes education
3. Medical nutrition therapy referral placed
4. Retrospective authorization for CGM device and insulin supplies

Electronically signed by: ${ctx.provider}, MD`,

  DME: (ctx) => `UROLOGY / ORTHOPAEDICS DME AUTHORIZATION NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Ordering Provider: ${ctx.provider}, MD - Urology / Orthopedics
Case Number: ${ctx.caseNumber}

CLINICAL INDICATION FOR DME:
Patient presents with neuromuscular bladder dysfunction (N31.9) and age-related osteoporosis with vertebral
fracture (M80.00). Post-void residual consistently 280 mL (Observation/pvr-${ctx.caseNumber}), requiring
intermittent catheterization. DEXA lumbar T-score -3.2 SD (Observation/dexa-${ctx.caseNumber}) confirms
severe osteoporosis with compression fracture risk.

REQUESTED EQUIPMENT:
1. Intermittent urinary catheters (HCPCS A4351) — post-void residual 280 mL, catheter-dependent
2. Lumbar orthosis (HCPCS L0648) — vertebral fracture T10 confirmed on MRI
3. Vitamin D 25-OH 14 ng/mL — supplementation ordered

MEDICAL NECESSITY STATEMENT:
Post-void residual of 280 mL exceeds the 200 mL threshold for catheter medical necessity per LCD L33803.
DEXA T-score -3.2 meets criteria for osteoporosis DME per Medicare coverage guidelines.

Electronically signed by: ${ctx.provider}, MD`,

  HH: (ctx) => `HOME HEALTH CERTIFICATION OF MEDICAL NECESSITY

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Certifying Physician: ${ctx.provider}, MD - PM&R
Case Number: ${ctx.caseNumber}

CLINICAL SUMMARY:
Patient is status-post ischemic stroke with sequelae (I69.30) and comorbid COPD (J44.9). Barthel Index 35
(Observation/barthel-${ctx.caseNumber}) — dependent in most ADLs. Gait: paralytic (R26.1). SpO2 92% on 2L
nasal cannula (Observation/spo2-${ctx.caseNumber}). FEV1 48% predicted (Observation/fev1-${ctx.caseNumber}).
Patient is homebound; ambulation limited to a few steps with maximum assist.

PLAN OF CARE:
- PT 5x/week x 4 weeks: gait retraining, strength, balance
- OT 3x/week x 4 weeks: ADL retraining, upper extremity function
- SN 2x/week: wound care, medication management, COPD monitoring
- MSW 1x/week: discharge planning, caregiver training

HOMEBOUND STATUS JUSTIFICATION:
Leaving home requires considerable and taxing effort. Barthel Index 35 with paralytic gait.

Electronically signed by: ${ctx.provider}, MD`,

  HIP: (ctx) => `ORTHOPAEDIC SURGERY PRE-AUTHORIZATION NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Surgeon: ${ctx.provider}, MD - Orthopaedic Surgery
Case Number: ${ctx.caseNumber}

CLINICAL INDICATION:
Right hip osteoarthritis (M16.11), Kellgren-Lawrence grade 4 (Observation/kl-${ctx.caseNumber}). Pain score
8/10 at rest, 10/10 with weight-bearing. Failed conservative therapy: 6 months formal PT, NSAIDs
(discontinued due to GI intolerance), two cortisone injections (no lasting relief). X-ray: complete
loss of joint space, subchondral sclerosis, osteophyte formation.

SURGICAL PLAN:
Total hip arthroplasty (CPT 27130), right side. Patient cleared by primary care. Hemoglobin 12.8 g/dL,
INR 1.0 — surgical risk acceptable.

CONSERVATIVE TREATMENT FAILURE DOCUMENTATION:
- PT x 18 sessions (6 months) — no functional improvement
- Intra-articular cortisone x2 — temporary relief < 4 weeks each
- NSAIDs — discontinued due to GI bleeding risk
- Activity modification — unable to perform household activities

Electronically signed by: ${ctx.provider}, MD`,

  IP: (ctx) => `INPATIENT HOSPITALIST ADMISSION NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Attending Hospitalist: ${ctx.provider}, MD
Case Number: ${ctx.caseNumber}

CHIEF COMPLAINT: Multi-system critical illness — respiratory failure, sepsis, heart failure

HISTORY OF PRESENT ILLNESS:
Patient admitted with acute respiratory failure (J96.00), SpO2 87% (Observation/spo2-${ctx.caseNumber}),
on BiPAP. Concurrent sepsis (A41.9): Temp 39.1°C, HR 118, BP 88 systolic, WBC 20.4
(Observation/wbc-${ctx.caseNumber}), Lactate 3.8 mmol/L (Observation/lactate-${ctx.caseNumber}),
Procalcitonin 8.4 ng/mL. Decompensated CHF: BNP 980 pg/mL (Observation/bnp-${ctx.caseNumber}).
pH 7.28 on ABG (Observation/ph-${ctx.caseNumber}) — combined metabolic and respiratory acidosis.

ASSESSMENT/PLAN:
1. Acute respiratory failure (J96.00) — BiPAP, supplemental O2, bronchodilators
2. Sepsis (A41.9) — blood cultures, broad-spectrum antibiotics, fluid resuscitation
3. Acute decompensated CHF (I50.9) — IV diuresis after hemodynamic stabilization
4. ICU-level care warranted; transfer to MICU pending bed availability

Electronically signed by: ${ctx.provider}, MD`,

  NFDS: (ctx) => `DIABETES NUTRITION SERVICES AUTHORIZATION NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Provider: ${ctx.provider}, RD/MD - Nutrition / Endocrinology
Case Number: ${ctx.caseNumber}

CLINICAL INDICATION:
Patient with T1DM (E10.9) and T2DM with hyperglycemia (E11.65) and neuropathy (E11.40). HbA1c 13.5%
(Observation/a1c-${ctx.caseNumber}). Fasting glucose 380 mg/dL (Observation/glucose-${ctx.caseNumber}).
BMI 35.8 kg/m². C-Peptide 0.2 ng/mL — confirms insulin deficiency. Urine ACR 380 mg/g — nephropathy
risk. Patient has not received formal MNT in >2 years.

PLAN:
- MNT individual sessions x8 (CPT 97802, 97803) over 12 weeks
- CGM initiation and carbohydrate counting education
- Insulin-to-carb ratio optimization
- Follow-up HbA1c at 12 weeks

MEDICAL NECESSITY:
HbA1c 13.5% with documented neuropathy and nephropathy risk meets Medicare/CMS criteria for MNT
authorization under benefit category for diabetes (Section 105 of BIPA 2000).

Electronically signed by: ${ctx.provider}, MD`,

  NS: (ctx) => `NUTRITION SUPPORT SERVICES AUTHORIZATION NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Provider: ${ctx.provider}, MD - Gastroenterology / Nutrition Support
Case Number: ${ctx.caseNumber}

CLINICAL INDICATION:
Patient presents with severe protein-calorie malnutrition (E43), feeding difficulty (R63.3), and
gastroparesis (K31.84). Albumin 2.2 g/dL (Observation/albumin-${ctx.caseNumber}) — consistent with
malnutrition. Pre-albumin 10 mg/dL — critically low. Body weight 51 kg, BMI 17.4, 18% weight loss
over 6 months (Observation/weightloss-${ctx.caseNumber}). Gastric emptying study T1/2 = 248 min
(normal <90 min) — severely delayed. Hemoglobin 9.8 g/dL — nutritional anemia.

PLAN:
1. PEG tube placement (CPT 43246) for enteral nutrition
2. Post-pyloric tube feeding to bypass gastroparesis
3. Goal rate: 50 mL/hr of semi-elemental formula
4. Dietitian follow-up weekly for tolerance and advancement

MEDICAL NECESSITY:
Albumin 2.2 g/dL + 18% weight loss + gastric emptying T1/2 248 min satisfies LCD L33786 criteria
for enteral nutrition coverage.

Electronically signed by: ${ctx.provider}, MD`,

  OOA: (ctx) => `OUT-OF-AREA EMERGENCY ADMISSION NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Attending: ${ctx.provider}, MD - Internal Medicine
Case Number: ${ctx.caseNumber}

CHIEF COMPLAINT: Respiratory distress, sepsis, and ESRD decompensation — out-of-area emergency

CLINICAL SUMMARY:
Patient traveled out-of-network area and presented emergently. COPD exacerbation with SpO2 88%
(Observation/spo2-${ctx.caseNumber}). Sepsis criteria met: Temp 38.8°C, HR 112, BP 92 systolic,
WBC 18.2 (Observation/wbc-${ctx.caseNumber}), Lactate 4.2 mmol/L (Observation/lactate-${ctx.caseNumber}).
ESRD: Creatinine 8.4 mg/dL (Observation/creatinine-${ctx.caseNumber}), BUN 78, eGFR 8, Potassium 6.1 —
hyperkalemia requiring urgent dialysis. BiPAP initiated. Emergent hemodialysis performed.

OUT-OF-AREA AUTHORIZATION REQUEST:
Patient could not safely travel to in-network facility. Life-threatening emergency per EMTALA.
Retrospective authorization requested per plan emergency provisions.

Electronically signed by: ${ctx.provider}, MD`,

  OP: (ctx) => `OUTPATIENT SURGERY PRE-AUTHORIZATION NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Surgeon: ${ctx.provider}, MD - Urology / General Surgery
Case Number: ${ctx.caseNumber}

CLINICAL INDICATION:
BPH with LUTS (N40.1): IPSS score 24 (Observation/ipss-${ctx.caseNumber}) — severe. PSA 8.2 ng/mL
(Observation/psa-${ctx.caseNumber}) — workup negative for malignancy (biopsy Gleason 6, low risk).
Post-void residual 320 mL — acute retention risk. Right knee OA (M17.11) and right hip OA (M16.11):
Kellgren-Lawrence grade 4 bilaterally, failed PT and injections. Planned staged procedures:
TURP (CPT 52601) followed by TKA (CPT 27447).

CONSERVATIVE TREATMENT FAILURE:
- Alpha-blocker and 5-ARI x12 months — inadequate symptom relief (IPSS 24)
- Physical therapy for OA x6 months — no functional improvement
- Intra-articular injections x2 per joint — temporary relief only

Electronically signed by: ${ctx.provider}, MD`,

  SKN: (ctx) => `INFECTIOUS DISEASE OUTPATIENT NOTE — CELLULITIS

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Attending: ${ctx.provider}, MD - Infectious Disease
Case Number: ${ctx.caseNumber}

CHIEF COMPLAINT: Facial cellulitis with SIRS criteria, IV antibiotic requirement

HISTORY OF PRESENT ILLNESS:
Patient presents with left facial cellulitis L03.211. Erythema 12 cm in diameter
(Observation/erythema-${ctx.caseNumber}), tender, warm, with induration. SIRS criteria met: Temp 38.9°C,
HR 106. WBC 16.8 (Observation/wbc-${ctx.caseNumber}), CRP 142 mg/L (Observation/crp-${ctx.caseNumber}).
Comorbid T2DM with glucose 280 mg/dL impairs immune response. Oral antibiotics failed after
72-hour course of cephalexin without improvement.

PLAN:
1. IV vancomycin via outpatient infusion center
2. Wound culture obtained
3. Glucose management during treatment
4. Re-evaluate 48 hours — if no improvement, consider inpatient admission

MEDICAL NECESSITY FOR IV ANTIBIOTICS:
SIRS criteria + erythema >9 cm + failed oral therapy meets criteria for IV antibiotics per IDSA
cellulitis guidelines.

Electronically signed by: ${ctx.provider}, MD`,

  SNF: (ctx) => `SKILLED NURSING FACILITY ADMISSION NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Attending: ${ctx.provider}, MD - Pulmonology
Case Number: ${ctx.caseNumber}

CLINICAL INDICATION FOR SNF ADMISSION:
Patient post-acute COPD exacerbation (J44.9) requiring skilled nursing care. FEV1 42% predicted
(Observation/fev1-${ctx.caseNumber}), FEV1/FVC 0.58. SpO2 90% on 2L NC at rest (Observation/spo2-${ctx.caseNumber}).
Requires skilled respiratory therapy, medication management (nebulizers, inhaled corticosteroids),
oxygen titration, and physical reconditioning following 5-day acute hospital stay. Patient lives alone
and cannot safely self-manage at home at current functional level.

SNF PLAN OF CARE:
- Respiratory therapy twice daily — bronchodilator treatments, breathing exercises
- PT daily — functional mobility, endurance training
- SN daily — oxygen monitoring, medication management, education
- Target discharge: home with home health when SpO2 >92% on room air with ambulation

Electronically signed by: ${ctx.provider}, MD`,

  TX: (ctx) => `TRANSPLANT HEPATOLOGY — INPATIENT AUTHORIZATION NOTE

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}  DOB: ${ctx.patient.dateOfBirth}  MRN: ${ctx.patient.mrn}
Date of Service: ${ctx.dos}
Attending: ${ctx.provider}, MD - Transplant Hepatology
Case Number: ${ctx.caseNumber}

CHIEF COMPLAINT: Decompensated cirrhosis with HCC — transplant evaluation

CLINICAL SUMMARY:
Patient with unspecified cirrhosis (K74.60) and hepatocellular carcinoma (C22.0). MELD score 28
(Observation/meld-${ctx.caseNumber}) — high waitlist priority. AFP 1800 ng/mL (Observation/afp-${ctx.caseNumber})
— markedly elevated, consistent with HCC. Bilirubin 4.2 mg/dL (Observation/bili-${ctx.caseNumber}).
INR 1.9 (Observation/inr-${ctx.caseNumber}). Ascites 2400 mL on US — tense, refractory. Albumin 2.6 g/dL.
Concurrent ESRD (N18.6), prior kidney transplant (Z94.0) — combined liver-kidney transplant evaluation
underway. Creatinine 2.1 mg/dL.

MILAN CRITERIA ASSESSMENT:
Single HCC lesion 3.2 cm on CT — within Milan criteria. UNOS listing recommended.

PLAN:
1. Orthotopic liver transplant evaluation (CPT 47135) — UNOS listing initiated
2. TIPS procedure for refractory ascites management
3. Locoregional therapy (TACE) as bridge to transplant
4. Combined liver-kidney transplant consideration given ESRD

MEDICAL NECESSITY:
MELD 28 with HCC within Milan criteria meets UNOS listing criteria. Inpatient admission required
for decompensated ascites, coagulopathy management, and multidisciplinary transplant evaluation.

Electronically signed by: ${ctx.provider}, MD`,
};

// ---------------------------------------------------------------------------
// Facility address pool (keyed by series)
// ---------------------------------------------------------------------------
const FACILITY_ADDRESSES: Record<string, string> = {
  ARF: '100 Medical Center Dr, Springfield, IL 62704',
  CHF: '500 Heart Institute Blvd, Chicago, IL 60601',
  DIA: '2200 Endocrine Way, Naperville, IL 60540',
  DME: '800 Supply Depot Ln, Rockford, IL 61101',
  HH: '340 Valley Road, Peoria, IL 61602',
  HIP: '1500 Orthopaedic Plaza, Downers Grove, IL 60515',
  IP: '900 University Ave, Champaign, IL 61820',
  NFDS: '770 Nutrition Blvd, Aurora, IL 60506',
  NS: '220 GI Center Dr, Joliet, IL 60432',
  OOA: '4500 Sunstate Pkwy, Orlando, FL 32801',
  OP: '300 Ambulatory Way, Elgin, IL 60120',
  SKN: '150 Infusion Center Ln, Waukegan, IL 60085',
  SNF: '680 Skilled Care Ave, Decatur, IL 62521',
  TX: '1 Transplant Institute Dr, Chicago, IL 60611',
};

// ---------------------------------------------------------------------------
// Coverage benefit templates per series
// ---------------------------------------------------------------------------
interface BenefitRow {
  benefitType: string;
  covered: boolean;
  requiresAuth: boolean;
  authCriteria: string;
}

const COVERAGE_BENEFITS: Record<string, BenefitRow[]> = {
  ARF: [{ benefitType: 'Inpatient Admission', covered: true, requiresAuth: true, authCriteria: 'Medical necessity review required for all inpatient admissions' }],
  CHF: [
    { benefitType: 'Inpatient Admission', covered: true, requiresAuth: true, authCriteria: 'Medical necessity review required for all inpatient admissions' },
    { benefitType: 'Echocardiography', covered: true, requiresAuth: false, authCriteria: 'No auth required for diagnostic echo' },
  ],
  DIA: [
    { benefitType: 'Outpatient Office Visit', covered: true, requiresAuth: false, authCriteria: 'Retrospective review per plan policy' },
    { benefitType: 'Medical Nutrition Therapy', covered: true, requiresAuth: true, authCriteria: 'Auth required for MNT >3 sessions per year' },
    { benefitType: 'CGM Device', covered: true, requiresAuth: true, authCriteria: 'A1C >7% required; A1C 13.5% meets criteria' },
  ],
  DME: [
    { benefitType: 'Urinary Catheters', covered: true, requiresAuth: true, authCriteria: 'Post-void residual >200 mL required per LCD L33803' },
    { benefitType: 'Lumbar Orthosis', covered: true, requiresAuth: true, authCriteria: 'Radiographic confirmation of fracture required' },
  ],
  HH: [
    { benefitType: 'Home Health PT/OT', covered: true, requiresAuth: true, authCriteria: 'Homebound status and skilled need required; Barthel Index supports' },
    { benefitType: 'Skilled Nursing Home Visit', covered: true, requiresAuth: true, authCriteria: 'Homebound and skilled need criteria' },
  ],
  HIP: [{ benefitType: 'Outpatient Surgery', covered: true, requiresAuth: true, authCriteria: 'Conservative treatment failure documentation required for THA/TKA' }],
  IP: [{ benefitType: 'Inpatient Admission', covered: true, requiresAuth: true, authCriteria: 'Medical necessity review required; MICU-level criteria evaluated' }],
  NFDS: [
    { benefitType: 'Medical Nutrition Therapy', covered: true, requiresAuth: true, authCriteria: 'BIPA 2000 criteria: T1DM or T2DM with complications; A1C 13.5% qualifies' },
  ],
  NS: [
    { benefitType: 'Enteral Nutrition', covered: true, requiresAuth: true, authCriteria: 'Albumin <3.0 and weight loss >10% required per LCD L33786' },
    { benefitType: 'PEG Tube Placement', covered: true, requiresAuth: true, authCriteria: 'Medical necessity documentation required' },
  ],
  OOA: [
    { benefitType: 'Emergency Out-of-Area Inpatient', covered: true, requiresAuth: false, authCriteria: 'Emergency admission — no prior auth required; retrospective review' },
    { benefitType: 'Emergent Dialysis', covered: true, requiresAuth: false, authCriteria: 'Emergency dialysis covered without prior auth' },
  ],
  OP: [
    { benefitType: 'Outpatient Surgery — TURP', covered: true, requiresAuth: true, authCriteria: 'IPSS >20 and failed medical therapy required' },
    { benefitType: 'Outpatient Surgery — TKA', covered: true, requiresAuth: true, authCriteria: 'Conservative treatment failure documentation required' },
  ],
  SKN: [
    { benefitType: 'Outpatient IV Infusion', covered: true, requiresAuth: true, authCriteria: 'SIRS criteria and failed oral antibiotics required per policy' },
  ],
  SNF: [
    { benefitType: 'Skilled Nursing Facility', covered: true, requiresAuth: true, authCriteria: '3-day qualifying inpatient stay required; skilled need documentation required' },
  ],
  TX: [
    { benefitType: 'Inpatient Transplant Evaluation', covered: true, requiresAuth: true, authCriteria: 'UNOS listing criteria, MELD score, and transplant committee review required' },
    { benefitType: 'Liver Transplant', covered: true, requiresAuth: true, authCriteria: 'UNOS listing, Milan criteria, multidisciplinary team approval required' },
  ],
};

// ---------------------------------------------------------------------------
// Plan metadata per series
// ---------------------------------------------------------------------------
interface PlanMeta {
  planId: string;
  planName: string;
  planType: string;
  groupNumber: string;
}

const PLAN_META: Record<string, PlanMeta> = {
  ARF: { planId: 'PLAN-MCARE-A', planName: 'Medicare Part A', planType: 'Medicare', groupNumber: 'MCARE-A' },
  CHF: { planId: 'PLAN-MCARE-AB', planName: 'Medicare Part A/B', planType: 'Medicare', groupNumber: 'MCARE-AB' },
  DIA: { planId: 'PLAN-BCBS-PPO', planName: 'BCBS PPO Plus', planType: 'Commercial PPO', groupNumber: 'GRP-BC-44321' },
  DME: { planId: 'PLAN-MCARE-B', planName: 'Medicare Part B', planType: 'Medicare', groupNumber: 'MCARE-B' },
  HH: { planId: 'PLAN-MCARE-A', planName: 'Medicare Part A', planType: 'Medicare', groupNumber: 'MCARE-A' },
  HIP: { planId: 'PLAN-AETNA-HMO', planName: 'Aetna HMO Select', planType: 'Commercial HMO', groupNumber: 'GRP-AET-77210' },
  IP: { planId: 'PLAN-MCARE-MA', planName: 'Medicare Advantage', planType: 'Medicare Advantage', groupNumber: 'MCARE-MA' },
  NFDS: { planId: 'PLAN-MCARE-B', planName: 'Medicare Part B', planType: 'Medicare', groupNumber: 'MCARE-B' },
  NS: { planId: 'PLAN-UHC-PPO', planName: 'UnitedHealth Choice Plus PPO', planType: 'Commercial PPO', groupNumber: 'GRP-UHC-55678' },
  OOA: { planId: 'PLAN-CIGNA-EPO', planName: 'Cigna Open Access EPO', planType: 'Commercial EPO', groupNumber: 'GRP-CGN-33492' },
  OP: { planId: 'PLAN-HUMANA-PPO', planName: 'Humana Medicare Advantage PPO', planType: 'Medicare Advantage', groupNumber: 'MCARE-MA-H' },
  SKN: { planId: 'PLAN-MOLINA-MC', planName: 'Molina Medicaid Complete', planType: 'Medicaid', groupNumber: 'GRP-MOL-12099' },
  SNF: { planId: 'PLAN-MCARE-A', planName: 'Medicare Part A', planType: 'Medicare', groupNumber: 'MCARE-A' },
  TX: { planId: 'PLAN-MCARE-AB', planName: 'Medicare Part A/B', planType: 'Medicare', groupNumber: 'MCARE-AB' },
};

// ---------------------------------------------------------------------------
// Case-number parsing helpers
// ---------------------------------------------------------------------------
function extractPrefix(caseNumber: string): string {
  const match = caseNumber.match(/^([A-Z]+)/);
  return match ? match[1] : 'IP';
}

function extractSequenceNumber(caseNumber: string): number {
  const match = caseNumber.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}

// ---------------------------------------------------------------------------
// Main data builders
// ---------------------------------------------------------------------------
function buildCaseData(caseNumber: string): UmCaseData {
  const prefix = extractPrefix(caseNumber);
  const meta = SERIES_META[prefix] ?? SERIES_META['IP'];
  const patientWithExtra = generatePatient(caseNumber) as UmCaseData['patient'] & { _memberId: string };
  const memberId = patientWithExtra._memberId;
  // Remove internal helper field
  const patient: UmCaseData['patient'] = {
    id: patientWithExtra.id,
    firstName: patientWithExtra.firstName,
    lastName: patientWithExtra.lastName,
    dateOfBirth: patientWithExtra.dateOfBirth,
    gender: patientWithExtra.gender,
    mrn: patientWithExtra.mrn,
  };
  const seqNum = extractSequenceNumber(caseNumber);
  const requestHoursAgo = 4 + (seqNum % 8);

  return {
    caseNumber,
    memberId,
    status: 'PENDING_REVIEW',
    urgency: meta.urgency,
    serviceType: meta.serviceType,
    requestDate: hoursAgo(requestHoursAgo),
    patient,
    requestingProvider: {
      id: `PROV-${prefix}-${seqNum.toString().padStart(3, '0')}`,
      name: meta.providerName,
      npi: meta.providerNpi,
      specialty: meta.specialty,
    },
    facility: {
      id: `FAC-${prefix}-001`,
      name: meta.facilityName,
      npi: meta.facilityNpi,
      address: FACILITY_ADDRESSES[prefix] ?? '100 Medical Center Dr, Springfield, IL 62704',
    },
  };
}

// ---------------------------------------------------------------------------
// Outcome tier — maps each case to a deterministic expected outcome
//   0 → AUTO_APPROVE  (40%): all criteria clearly MET
//   1 → MD_REVIEW     (30%): key threshold values borderline / NOT_MET
//   2 → MORE_INFO     (20%): missing diagnostic labs → UNKNOWN
//   3 → DENY          (10%): values clearly insufficient / NOT_MET
// ---------------------------------------------------------------------------
function getOutcomeTier(caseNumber: string): 0 | 1 | 2 | 3 {
  // ARF-2026-001 is always AUTO_APPROVE (preserved original)
  if (caseNumber === 'ARF-2026-001') return 0;
  const h = hashCode(caseNumber) % 10;
  if (h <= 3) return 0;
  if (h <= 6) return 1;
  if (h <= 8) return 2;
  return 3;
}

function applyOutcomeVariant(
  template: ClinicalTemplate,
  tier: 0 | 1 | 2 | 3,
): ClinicalTemplate {
  if (tier === 0) return template;

  if (tier === 1) {
    // MD_REVIEW: adjust threshold-critical values to be above/outside limits
    return {
      ...template,
      vitals: template.vitals.map((v) => {
        if (v.type === 'SpO2')                              return { ...v, value: 91 };
        if (v.type === 'Respiratory Rate')                  return { ...v, value: 19 };
        if (v.type === 'Heart Rate'       && v.value > 100) return { ...v, value: 93 };
        if (v.type === 'Temperature'      && v.value > 38)  return { ...v, value: 37.6 };
        if (v.type === 'Blood Pressure Systolic' && v.value < 90) return { ...v, value: 104 };
        if (v.type === 'Blood Glucose')   return { ...v, value: 165 };
        if (v.type === 'Pain Score')      return { ...v, value: 4 };
        return v;
      }),
      labs: template.labs.map((l) => {
        if (l.name === 'pO2')                return { ...l, value: 64 };
        if (l.name === 'pCO2')               return { ...l, value: 43 };
        if (l.name === 'pH')                 return { ...l, value: 7.37 };
        if (l.name === 'BNP')                return { ...l, value: 520 };
        if (l.name === 'LVEF (Echo)')        return { ...l, value: 40 };
        if (l.name === 'Lactate')            return { ...l, value: 1.7 };
        if (l.name === 'Procalcitonin')      return { ...l, value: 1.1 };
        if (l.name === 'WBC')                return { ...l, value: 10.4 };
        if (l.name === 'HbA1c')              return { ...l, value: 7.8 };
        if (l.name === 'Fasting Glucose')    return { ...l, value: 165 };
        if (l.name === 'Post-Void Residual') return { ...l, value: 140 };
        if (l.name === 'Barthel Index')      return { ...l, value: 68 };
        if (l.name === 'Albumin')            return { ...l, value: 3.1 };
        if (l.name === 'DEXA T-score (Lumbar)') return { ...l, value: -2.2 };
        return l;
      }),
    };
  }

  if (tier === 2) {
    // MORE_INFO: strip key diagnostic labs CQL depends on → UNKNOWN result
    const STRIP_LABS = new Set([
      'pO2', 'pH', 'pCO2', 'LVEF (Echo)', 'BNP', 'Procalcitonin',
      'Post-Void Residual', 'Barthel Index', 'Kellgren-Lawrence Grade (X-ray)',
      'HbA1c', 'Albumin', 'Gastric Emptying T1/2', 'DEXA T-score (Lumbar)',
    ]);
    const STRIP_VITALS = new Set(['SpO2']);
    return {
      ...template,
      vitals: template.vitals.filter((v) => !STRIP_VITALS.has(v.type)),
      labs:   template.labs.filter((l)   => !STRIP_LABS.has(l.name)),
    };
  }

  // tier === 3 — DENY: values clearly do not support medical necessity
  return {
    ...template,
    vitals: template.vitals.map((v) => {
      if (v.type === 'SpO2')                              return { ...v, value: 97 };
      if (v.type === 'Respiratory Rate')                  return { ...v, value: 15 };
      if (v.type === 'Heart Rate'       && v.value > 100) return { ...v, value: 76 };
      if (v.type === 'Temperature'      && v.value > 38)  return { ...v, value: 37.1 };
      if (v.type === 'Blood Pressure Systolic' && v.value < 90) return { ...v, value: 118 };
      if (v.type === 'Blood Glucose')   return { ...v, value: 98 };
      if (v.type === 'Pain Score')      return { ...v, value: 2 };
      return v;
    }),
    labs: template.labs.map((l) => {
      if (l.name === 'pO2')                return { ...l, value: 86 };
      if (l.name === 'pCO2')               return { ...l, value: 37 };
      if (l.name === 'pH')                 return { ...l, value: 7.41 };
      if (l.name === 'BNP')                return { ...l, value: 142 };
      if (l.name === 'LVEF (Echo)')        return { ...l, value: 57 };
      if (l.name === 'Lactate')            return { ...l, value: 0.8 };
      if (l.name === 'Procalcitonin')      return { ...l, value: 0.08 };
      if (l.name === 'WBC')                return { ...l, value: 8.1 };
      if (l.name === 'HbA1c')              return { ...l, value: 6.4 };
      if (l.name === 'Fasting Glucose')    return { ...l, value: 98 };
      if (l.name === 'Post-Void Residual') return { ...l, value: 60 };
      if (l.name === 'Barthel Index')      return { ...l, value: 90 };
      if (l.name === 'Albumin')            return { ...l, value: 3.8 };
      if (l.name === 'DEXA T-score (Lumbar)') return { ...l, value: -1.8 };
      return l;
    }),
  };
}

function buildClinicalData(caseNumber: string): UmClinicalData {
  const prefix = extractPrefix(caseNumber);
  const baseTemplate = CLINICAL_TEMPLATES[prefix] ?? CLINICAL_TEMPLATES['IP'];
  const tier = getOutcomeTier(caseNumber);
  const template = applyOutcomeVariant(baseTemplate, tier);
  const seqNum = extractSequenceNumber(caseNumber);
  const observedAt = hoursAgo(2 + (seqNum % 3));
  const collectedAt = hoursAgo(2 + (seqNum % 4));

  return {
    caseNumber,
    diagnoses: template.diagnoses,
    procedures: template.procedures,
    vitals: template.vitals.map((v) => ({ ...v, observedAt })),
    labs: template.labs.map((l) => ({ ...l, collectedAt })),
  };
}

function buildAttachments(caseNumber: string): UmAttachment[] {
  const prefix = extractPrefix(caseNumber);
  const seqNum = extractSequenceNumber(caseNumber);
  const uploadedAt = hoursAgo(3 + (seqNum % 5));
  return [
    {
      attachmentId: `ATT-${caseNumber}-001`,
      fileName: `${prefix}_Physician_Note_${caseNumber}.pdf`,
      mimeType: 'application/pdf',
      category: 'CLINICAL_NOTE',
      uploadDate: uploadedAt,
      fileSizeBytes: 42_000 + (seqNum * 1_337) % 30_000,
    },
    {
      attachmentId: `ATT-${caseNumber}-002`,
      fileName: `${prefix}_Lab_Results_${caseNumber}.pdf`,
      mimeType: 'application/pdf',
      category: 'LAB_RESULT',
      uploadDate: uploadedAt,
      fileSizeBytes: 10_000 + (seqNum * 811) % 15_000,
    },
  ];
}

function buildAttachmentContent(
  caseNumber: string,
  attachmentId: string,
): { base64Content: string; mimeType: string; fileName: string } {
  const prefix = extractPrefix(caseNumber);
  const generator = NOTE_GENERATORS[prefix] ?? NOTE_GENERATORS['IP'];
  const patientWithExtra = generatePatient(caseNumber) as UmCaseData['patient'] & { _memberId: string };
  const meta = SERIES_META[prefix] ?? SERIES_META['IP'];

  const noteText = generator({
    patient: {
      firstName: patientWithExtra.firstName,
      lastName: patientWithExtra.lastName,
      dateOfBirth: patientWithExtra.dateOfBirth,
      mrn: patientWithExtra.mrn ?? `MRN-${caseNumber}`,
    },
    caseNumber,
    provider: meta.providerName,
    dos: new Date().toLocaleDateString(),
  });

  const isLab = attachmentId.endsWith('-002');
  const template = CLINICAL_TEMPLATES[prefix] ?? CLINICAL_TEMPLATES['IP'];
  const labText = isLab
    ? buildLabReportText(caseNumber, patientWithExtra, template)
    : noteText;

  return {
    base64Content: Buffer.from(isLab ? labText : noteText).toString('base64'),
    mimeType: 'application/pdf',
    fileName: isLab
      ? `${prefix}_Lab_Results_${caseNumber}.pdf`
      : `${prefix}_Physician_Note_${caseNumber}.pdf`,
  };
}

function buildLabReportText(
  caseNumber: string,
  patient: UmCaseData['patient'],
  template: ClinicalTemplate,
): string {
  const lines: string[] = [
    `LABORATORY REPORT`,
    ``,
    `Patient: ${patient.firstName} ${patient.lastName}  DOB: ${patient.dateOfBirth}  MRN: ${patient.mrn}`,
    `Collection Date/Time: ${new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleString()}`,
    `Case Number: ${caseNumber}`,
    ``,
    `RESULTS:`,
  ];
  for (const lab of template.labs) {
    lines.push(`  ${lab.name.padEnd(40)} ${String(lab.value).padStart(8)} ${lab.unit}  (LOINC: ${lab.loincCode})`);
  }
  lines.push(``, `Verified by: Laboratory Director`);
  return lines.join('\n');
}

function buildCaseHistory(caseNumber: string): UmHistoryEntry[] {
  const seqNum = extractSequenceNumber(caseNumber);
  const prefix = extractPrefix(caseNumber);
  const meta = SERIES_META[prefix] ?? SERIES_META['IP'];
  return [
    {
      timestamp: hoursAgo(6 + (seqNum % 4)),
      action: 'CASE_CREATED',
      actor: 'System',
      notes: 'Case submitted via electronic authorization request',
    },
    {
      timestamp: hoursAgo(4 + (seqNum % 3)),
      action: 'DOCUMENTS_ATTACHED',
      actor: meta.providerName,
      actorRole: 'Requesting Provider',
      notes: 'Physician note and lab results uploaded',
    },
    {
      timestamp: hoursAgo(1),
      action: 'REVIEW_INITIATED',
      actor: 'System',
      notes: 'Case assigned for AI-assisted review',
    },
  ];
}

function buildCaseNotes(caseNumber: string): UmCaseNote[] {
  const seqNum = extractSequenceNumber(caseNumber);
  const prefix = extractPrefix(caseNumber);
  const meta = SERIES_META[prefix] ?? SERIES_META['IP'];
  const template = CLINICAL_TEMPLATES[prefix] ?? CLINICAL_TEMPLATES['IP'];
  const primaryDx = template.diagnoses[0];

  return [
    {
      noteId: `NOTE-${caseNumber}-001`,
      author: meta.providerName,
      authorRole: 'Requesting Provider',
      timestamp: hoursAgo(4 + (seqNum % 3)),
      text: `Patient requires ${meta.urgency === 'URGENT' ? 'urgent' : 'standard'} ${meta.serviceType} for ${primaryDx.description} (${primaryDx.code}). Clinical data attached. Medical necessity criteria met.`,
      noteType: 'CLINICAL',
    },
    {
      noteId: `NOTE-${caseNumber}-002`,
      author: 'Registration Staff',
      authorRole: 'Administrative',
      timestamp: hoursAgo(6 + (seqNum % 4)),
      text: `Coverage verified. Patient has active coverage. Authorization request submitted per plan policy.`,
      noteType: 'ADMINISTRATIVE',
    },
  ];
}

function buildMemberCoverage(memberId: string, prefix: string): UmCoverageData {
  const plan = PLAN_META[prefix] ?? PLAN_META['IP'];
  const benefits = COVERAGE_BENEFITS[prefix] ?? COVERAGE_BENEFITS['IP'];
  return {
    memberId,
    planId: plan.planId,
    planName: plan.planName,
    planType: plan.planType,
    groupNumber: plan.groupNumber,
    effectiveDate: '2023-01-01',
    coverageActive: true,
    benefits,
  };
}

// ---------------------------------------------------------------------------
// ARF-2026-001 exact original data (preserved verbatim)
// ---------------------------------------------------------------------------
const _ARF_001_NOW = new Date().toISOString();
const _ARF_001_TWO_H = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const _ARF_001_FOUR_H = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
const _ARF_001_SIX_H = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

const ARF_001_CASE: UmCaseData = {
  caseNumber: 'ARF-2026-001',
  memberId: 'MBR-123456',
  status: 'PENDING_REVIEW',
  urgency: 'URGENT',
  serviceType: 'Inpatient Admission',
  requestDate: _ARF_001_SIX_H,
  patient: {
    id: 'PAT-001',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1958-03-15',
    gender: 'male',
    mrn: 'MRN-789012',
  },
  requestingProvider: {
    id: 'PROV-001',
    name: 'Dr. Sarah Chen',
    npi: '1234567890',
    specialty: 'Emergency Medicine',
  },
  facility: {
    id: 'FAC-001',
    name: 'City General Hospital',
    npi: '9876543210',
    address: '100 Medical Center Dr, Springfield, IL 62704',
  },
};

const ARF_001_CLINICAL: UmClinicalData = {
  caseNumber: 'ARF-2026-001',
  diagnoses: [
    {
      code: 'J96.00',
      codeSystem: 'ICD-10-CM',
      description: 'Acute respiratory failure, unspecified whether with hypoxia or hypercapnia',
      type: 'PRIMARY',
    },
    {
      code: 'J44.1',
      codeSystem: 'ICD-10-CM',
      description: 'Chronic obstructive pulmonary disease with (acute) exacerbation',
      type: 'SECONDARY',
    },
  ],
  procedures: [
    {
      code: '94660',
      codeSystem: 'CPT',
      description: 'Continuous positive airway pressure ventilation (CPAP)',
    },
  ],
  vitals: [
    { type: 'SpO2', value: 87, unit: '%', observedAt: _ARF_001_TWO_H },
    { type: 'Respiratory Rate', value: 28, unit: 'breaths/min', observedAt: _ARF_001_TWO_H },
    { type: 'Heart Rate', value: 110, unit: 'bpm', observedAt: _ARF_001_TWO_H },
    { type: 'Temperature', value: 38.2, unit: '°C', observedAt: _ARF_001_TWO_H },
  ],
  labs: [
    { name: 'pO2', value: 55, unit: 'mmHg', loincCode: '2703-7', collectedAt: _ARF_001_TWO_H },
    { name: 'pCO2', value: 52, unit: 'mmHg', loincCode: '2019-8', collectedAt: _ARF_001_TWO_H },
    { name: 'pH', value: 7.31, unit: '', loincCode: '2744-1', collectedAt: _ARF_001_TWO_H },
    { name: 'WBC', value: 14.2, unit: '10^3/uL', loincCode: '6690-2', collectedAt: _ARF_001_FOUR_H },
    { name: 'Lactate', value: 2.8, unit: 'mmol/L', loincCode: '2524-7', collectedAt: _ARF_001_TWO_H },
  ],
};

const ARF_001_ATTACHMENTS: UmAttachment[] = [
  {
    attachmentId: 'ATT-001',
    fileName: 'ED_Physician_Note.pdf',
    mimeType: 'application/pdf',
    category: 'CLINICAL_NOTE',
    uploadDate: _ARF_001_FOUR_H,
    fileSizeBytes: 45_200,
  },
  {
    attachmentId: 'ATT-002',
    fileName: 'ABG_Results.pdf',
    mimeType: 'application/pdf',
    category: 'LAB_RESULT',
    uploadDate: _ARF_001_TWO_H,
    fileSizeBytes: 12_800,
  },
];

const _ARF_001_ED_NOTE = `EMERGENCY DEPARTMENT PHYSICIAN NOTE

Patient: John Doe  DOB: 03/15/1958  MRN: MRN-789012
Date of Service: ${new Date().toLocaleDateString()}
Attending: Dr. Sarah Chen, MD - Emergency Medicine

CHIEF COMPLAINT: Acute shortness of breath, worsening over 6 hours

HISTORY OF PRESENT ILLNESS:
68-year-old male with known history of COPD presents to the ED with acute onset dyspnea.
Patient reports progressive shortness of breath over the past 6 hours, worsening despite
use of home nebulizer treatments. He denies chest pain but endorses increased sputum
production with yellow-green sputum. He has been compliant with his home medications
including tiotropium and albuterol PRN.

PAST MEDICAL HISTORY:
- COPD (diagnosed 2018)
- Hypertension
- Type 2 Diabetes Mellitus
- Former smoker (quit 2020, 40 pack-year history)

PHYSICAL EXAMINATION:
- General: Alert, oriented, in moderate respiratory distress, using accessory muscles
- Vitals: T 38.2C, HR 110, RR 28, BP 148/92, SpO2 87% on room air
- Lungs: Diffuse bilateral wheezing, prolonged expiratory phase, decreased breath sounds at bases
- Heart: Tachycardic, regular rhythm, no murmurs
- Extremities: No edema, no cyanosis

DIAGNOSTIC RESULTS:
- ABG: pH 7.31, pCO2 52 mmHg, pO2 55 mmHg, HCO3 24, O2 Sat 87%
- CXR: Hyperinflated lungs, no focal consolidation, no pleural effusion
- WBC 14.2 (mild leukocytosis)
- Lactate 2.8 mmol/L

ASSESSMENT/PLAN:
1. Acute respiratory failure (J96.00) secondary to COPD exacerbation (J44.1)
2. Hypoxemic and hypercapnic respiratory failure
3. Started on BiPAP, IV methylprednisolone, nebulized bronchodilators
4. Admission to medical floor recommended for continued respiratory support
5. If no improvement on BiPAP, may require ICU transfer and possible intubation

MEDICAL NECESSITY FOR INPATIENT ADMISSION:
Patient meets criteria for inpatient admission due to acute respiratory failure with
SpO2 87% on room air, requiring continuous BiPAP support, IV corticosteroids, and
close monitoring. Outpatient management is not appropriate given severity of hypoxemia
and risk of respiratory decompensation.

Electronically signed by: Sarah Chen, MD
`;

const _ARF_001_ABG = `ARTERIAL BLOOD GAS RESULTS

Patient: John Doe  DOB: 03/15/1958  MRN: MRN-789012
Collection Date/Time: ${new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleString()}
Specimen: Arterial Blood

RESULTS:
  pH:        7.31    (Reference: 7.35-7.45)    [LOW]
  pCO2:      52 mmHg (Reference: 35-45 mmHg)   [HIGH]
  pO2:       55 mmHg (Reference: 80-100 mmHg)  [LOW]
  HCO3:      24 mEq/L (Reference: 22-26 mEq/L) [NORMAL]
  O2 Sat:    87%     (Reference: 95-100%)       [LOW]
  Base Excess: -2 mEq/L

INTERPRETATION:
Partially compensated respiratory acidosis with hypoxemia.
Findings consistent with acute-on-chronic respiratory failure.

Performed by: Lab Tech J. Martinez
Verified by: Dr. R. Patel, Pathology
`;

const ARF_001_ATTACHMENT_CONTENT: Record<
  string,
  { base64Content: string; mimeType: string; fileName: string }
> = {
  'ATT-001': {
    base64Content: Buffer.from(_ARF_001_ED_NOTE).toString('base64'),
    mimeType: 'application/pdf',
    fileName: 'ED_Physician_Note.pdf',
  },
  'ATT-002': {
    base64Content: Buffer.from(_ARF_001_ABG).toString('base64'),
    mimeType: 'application/pdf',
    fileName: 'ABG_Results.pdf',
  },
};

const ARF_001_HISTORY: UmHistoryEntry[] = [
  {
    timestamp: _ARF_001_SIX_H,
    action: 'CASE_CREATED',
    actor: 'System',
    notes: 'Case submitted via electronic authorization request',
  },
  {
    timestamp: _ARF_001_FOUR_H,
    action: 'DOCUMENTS_ATTACHED',
    actor: 'Dr. Sarah Chen',
    actorRole: 'Requesting Provider',
    notes: 'ED physician note and ABG results uploaded',
  },
  {
    timestamp: _ARF_001_NOW,
    action: 'REVIEW_INITIATED',
    actor: 'System',
    notes: 'Case assigned for AI-assisted review',
  },
];

const ARF_001_NOTES: UmCaseNote[] = [
  {
    noteId: 'NOTE-001',
    author: 'Dr. Sarah Chen',
    authorRole: 'Requesting Provider',
    timestamp: _ARF_001_FOUR_H,
    text: 'Patient requires urgent inpatient admission for acute respiratory failure. SpO2 87% on room air, requiring BiPAP and IV steroids. Not safe for outpatient management.',
    noteType: 'CLINICAL',
  },
  {
    noteId: 'NOTE-002',
    author: 'Registration Staff',
    authorRole: 'Administrative',
    timestamp: _ARF_001_SIX_H,
    text: 'Medicare Part A coverage verified. Patient has active coverage through MBR-123456.',
    noteType: 'ADMINISTRATIVE',
  },
];

const ARF_001_COVERAGE: UmCoverageData = {
  memberId: 'MBR-123456',
  planId: 'PLAN-MCARE-A',
  planName: 'Medicare Part A',
  planType: 'Medicare',
  groupNumber: 'MCARE-A',
  effectiveDate: '2023-01-01',
  coverageActive: true,
  benefits: [
    {
      benefitType: 'Inpatient Admission',
      covered: true,
      requiresAuth: true,
      authCriteria: 'Medical necessity review required for all inpatient admissions',
    },
  ],
};

// ---------------------------------------------------------------------------
// Exported adapter class
// ---------------------------------------------------------------------------
export class MockUmAdapter {
  async getCase(caseNumber: string): Promise<UmCaseData> {
    if (caseNumber === 'ARF-2026-001') return ARF_001_CASE;
    return buildCaseData(caseNumber);
  }

  async getClinicalInfo(caseNumber: string): Promise<UmClinicalData> {
    if (caseNumber === 'ARF-2026-001') return ARF_001_CLINICAL;
    return buildClinicalData(caseNumber);
  }

  async getAttachments(caseNumber: string): Promise<UmAttachment[]> {
    if (caseNumber === 'ARF-2026-001') return ARF_001_ATTACHMENTS;
    return buildAttachments(caseNumber);
  }

  async downloadAttachment(
    caseNumber: string,
    attachmentId: string,
  ): Promise<{ base64Content: string; mimeType: string; fileName: string }> {
    if (caseNumber === 'ARF-2026-001') {
      const content = ARF_001_ATTACHMENT_CONTENT[attachmentId];
      if (!content) {
        throw new Error(`Mock: attachment ${attachmentId} not found for case ${caseNumber}`);
      }
      return content;
    }
    return buildAttachmentContent(caseNumber, attachmentId);
  }

  async getCaseHistory(caseNumber: string): Promise<UmHistoryEntry[]> {
    if (caseNumber === 'ARF-2026-001') return ARF_001_HISTORY;
    return buildCaseHistory(caseNumber);
  }

  async getCaseNotes(caseNumber: string): Promise<UmCaseNote[]> {
    if (caseNumber === 'ARF-2026-001') return ARF_001_NOTES;
    return buildCaseNotes(caseNumber);
  }

  async getMemberCoverage(memberId: string): Promise<UmCoverageData> {
    // ARF-2026-001 original member
    if (memberId === 'MBR-123456') return ARF_001_COVERAGE;

    // Attempt to infer series from MBR ID by scanning all series for a matching member
    // Fall back to a generic active plan if the memberId is completely unknown
    for (const prefix of Object.keys(SERIES_META)) {
      // We cannot reverse-derive the caseNumber from a memberId alone, so we return
      // a sensible coverage record keyed to the plan type for this prefix.
      // In practice, callers pass the memberId from getCase() which always has a matching prefix.
    }

    // Generic fallback — return an active commercial plan so unknown members never throw
    return {
      memberId,
      planId: 'PLAN-GENERIC-PPO',
      planName: 'Generic Commercial PPO',
      planType: 'Commercial PPO',
      groupNumber: 'GRP-GENERIC',
      effectiveDate: '2023-01-01',
      coverageActive: true,
      benefits: [
        {
          benefitType: 'Inpatient Admission',
          covered: true,
          requiresAuth: true,
          authCriteria: 'Medical necessity review required',
        },
        {
          benefitType: 'Outpatient Services',
          covered: true,
          requiresAuth: false,
          authCriteria: 'No prior authorization required for standard outpatient services',
        },
      ],
    };
  }
}
