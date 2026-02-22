#!/usr/bin/env node
/**
 * Clinical Guideline → INTERNAL Criteria Generator
 *
 * Generates INTERNAL coverage criteria for the top 10 inpatient diagnoses
 * from published ACC/AHA, IDSA, ATS, Surviving Sepsis Campaign guidelines.
 *
 * Usage:
 *   npx tsx scripts/generate-criteria-from-guidelines.ts
 *   npx tsx scripts/generate-criteria-from-guidelines.ts --dry-run
 *   npx tsx scripts/generate-criteria-from-guidelines.ts --id INTERNAL-CHF-INPATIENT-v1
 *
 * Environment (passed directly or via packages/backend/.env):
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *   AWS_REGION, AWS_PROFILE, BEDROCK_MODEL_ID
 */

import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Bootstrap: load .env from packages/backend if DB_PASSWORD not already set
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnvFile(envPath: string): void {
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    // Only set if key is absent OR currently empty — never overwrite a non-empty value
    if (key && !process.env[key]) {
      process.env[key] = val;
    }
  }
}

// Load backend .env / .env.test for DB creds if not already in environment.
// Priority: .env (production/local) → .env.test (test/CI) — never overwrites
// existing env vars so explicit CLI exports always win.
if (!process.env.DB_PASSWORD) {
  loadEnvFile(resolve(ROOT, 'packages/backend/.env'));
}
if (!process.env.DB_PASSWORD) {
  loadEnvFile(resolve(ROOT, 'packages/backend/.env.test'));
}
// When falling back to .env.test the DB_NAME will be lucidreview_test (the test DB).
// Override to 'lucidreview' (the main production/dev DB) so criteria land in the right place.
if (process.env.DB_NAME === 'lucidreview_test') {
  process.env.DB_NAME = 'lucidreview';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuidelineCriteria {
  id: string;
  title: string;
  diagnosisCodes: string[];
  scopeSetting: 'INPATIENT';
  scopeRequestType: 'ADMISSION' | 'CONTINUED_STAY';
  guideline: string;
  guidelineUrl: string;
  admissionCriteria: string;
}

interface CriteriaResult {
  dslJson: object;
  diagnosisCodes: string[];
  scopeSetting: 'INPATIENT' | 'OUTPATIENT' | 'DME' | 'HOME_HEALTH';
  scopeRequestType: 'ADMISSION' | 'CONTINUED_STAY' | 'PROCEDURE' | 'SERVICE' | 'MEDICATION' | 'DME';
  summary: string;
}

// ---------------------------------------------------------------------------
// Guideline definitions — top 10 inpatient diagnoses
// ---------------------------------------------------------------------------

const GUIDELINES: GuidelineCriteria[] = [
  {
    id: 'INTERNAL-CHF-INPATIENT-v1',
    title: 'Heart Failure — Inpatient Admission Criteria',
    diagnosisCodes: ['I50.9','I50.1','I50.20','I50.30','I50.40','I50.810','I50.811','I50.812','I50.813','I50.814'],
    scopeSetting: 'INPATIENT',
    scopeRequestType: 'ADMISSION',
    guideline: '2022 AHA/ACC/HFSA Heart Failure Guideline (Circulation 2022)',
    guidelineUrl: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063',
    admissionCriteria: `Per the 2022 AHA/ACC/HFSA Heart Failure Guideline, inpatient admission is indicated when ANY of the following are present:
1. Hemodynamic compromise: SBP <90 mmHg, HR >100 bpm unresponsive to initial treatment, or signs of hypoperfusion (cool extremities, altered mentation, oliguria)
2. Severe respiratory distress: SpO2 <90% on room air, RR >25, requiring supplemental O2 >4L/min, or requiring non-invasive ventilation (CPAP/BiPAP)
3. Worsening renal function: Creatinine increase >0.3 mg/dL or >50% from baseline
4. Electrolyte disturbance requiring IV correction: K+ <3.0 or >5.5 mEq/L, Na+ <130 mEq/L
5. Troponin elevation suggesting ACS as precipitant
6. BNP >500 pg/mL or NT-proBNP >2000 pg/mL with clinical decompensation
7. Failure of outpatient intensification: significant fluid overload (>2kg weight gain) not responding to oral diuretics, or inability to tolerate oral medications
8. High-risk social factors: inability to comply with monitoring or medication regimen as outpatient`,
  },
  {
    id: 'INTERNAL-SEPSIS-INPATIENT-v1',
    title: 'Sepsis and Septic Shock — Inpatient Admission Criteria',
    diagnosisCodes: ['A41.9','A41.01','A41.02','A41.1','A41.2','A41.3','A41.50','A40.0','A40.1','A40.9','R65.20','R65.21'],
    scopeSetting: 'INPATIENT',
    scopeRequestType: 'ADMISSION',
    guideline: 'Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2021',
    guidelineUrl: 'https://doi.org/10.1007/s00134-021-06406-5',
    admissionCriteria: `Per the Surviving Sepsis Campaign 2021 Guidelines, inpatient admission is required when ALL of:
Sepsis diagnosis: Life-threatening organ dysfunction (SOFA score ≥2 points) caused by a dysregulated host response to infection.
AND at least one of:
1. qSOFA score ≥2: altered mentation (GCS <15), RR ≥22/min, SBP ≤100 mmHg
2. Septic shock: vasopressors required to maintain MAP ≥65 mmHg AND serum lactate >2 mmol/L despite adequate fluid resuscitation
3. Organ dysfunction criteria (any):
   - Acute kidney injury: creatinine >1.2 mg/dL or urine output <0.5 mL/kg/hr for 2hr
   - Bilirubin >1.2 mg/dL (hepatic)
   - Platelet count <100,000/μL
   - INR >1.5 or aPTT >60 sec (coagulation)
   - PaO2/FiO2 <400 (respiratory)
   - GCS <15 (neurological)
4. Lactate >2 mmol/L indicating tissue hypoperfusion
Hour-1 Bundle required: blood cultures before antibiotics, broad-spectrum IV antibiotics within 1 hour, 30 mL/kg crystalloid if hypotensive or lactate ≥4 mmol/L`,
  },
  {
    id: 'INTERNAL-CAP-INPATIENT-v1',
    title: 'Community-Acquired Pneumonia — Inpatient Admission Criteria',
    diagnosisCodes: ['J18.9','J18.1','J18.0','J15.9','J15.0','J15.1','J15.3','J15.4','J15.5','J15.6','J15.7','J13','J14'],
    scopeSetting: 'INPATIENT',
    scopeRequestType: 'ADMISSION',
    guideline: 'IDSA/ATS Consensus Guidelines on CAP in Adults (CID 2007 + 2019 Update)',
    guidelineUrl: 'https://doi.org/10.1086/516888',
    admissionCriteria: `Per IDSA/ATS CAP Guidelines, inpatient admission is indicated when:
PRIMARY: CURB-65 score ≥2 or PSI/PORT Class III-V
CURB-65 scoring (1 point each):
  - Confusion (new onset, MMSE ≤8)
  - Urea (BUN) >19 mg/dL (>7 mmol/L)
  - Respiratory Rate ≥30/min
  - Blood pressure: SBP <90 mmHg OR DBP ≤60 mmHg
  - Age ≥65 years
CURB-65 ≥2: Inpatient admission. CURB-65 ≥3: Consider ICU.
ICU admission criteria (minor): RR ≥30, PaO2/FiO2 ≤250, multilobar infiltrates, confusion, BUN ≥20, WBC <4000, platelets <100k, temp <36°C, hypotension requiring aggressive resuscitation
ICU admission criteria (major): invasive mechanical ventilation required OR septic shock with vasopressors
SpO2 <90% on room air or PaO2 <60 mmHg requires hospital-level oxygen management`,
  },
  {
    id: 'INTERNAL-COPD-INPATIENT-v1',
    title: 'COPD Exacerbation — Inpatient Admission Criteria',
    diagnosisCodes: ['J44.1','J44.0','J44.9','J96.00','J96.01','J96.09'],
    scopeSetting: 'INPATIENT',
    scopeRequestType: 'ADMISSION',
    guideline: 'GOLD 2024 Global Strategy for COPD + ATS/ERS AECOPD Guidelines',
    guidelineUrl: 'https://goldcopd.org/2024-gold-report/',
    admissionCriteria: `Per GOLD 2024 and ATS/ERS guidelines, inpatient admission for AECOPD is indicated when ANY of:
1. Severe dyspnea not adequately responding to initial emergency management
2. SpO2 <90% or PaO2 <60 mmHg on supplemental oxygen
3. Acute/acute-on-chronic respiratory acidosis: pH <7.35 with PaCO2 >45 mmHg
4. Altered mental status (confusion, lethargy, coma)
5. Hemodynamic instability (SBP <90 mmHg, HR >110 bpm)
6. Inability to eat, sleep, or perform basic ADLs due to dyspnea
7. Failure of outpatient management or inadequate home support
8. High-risk comorbidities requiring monitoring: cardiac arrhythmia, recently started long-term oxygen therapy
NIV (BiPAP) indication: pH <7.35, PaCO2 >45 mmHg, RR >25/min — requires hospital-level monitoring
Diagnostic criteria: ≥2 of (increased dyspnea, increased sputum volume, increased sputum purulence) OR 1 cardinal plus fever or within 5 days of URI`,
  },
  {
    id: 'INTERNAL-STEMI-INPATIENT-v1',
    title: 'Acute Myocardial Infarction (STEMI/NSTEMI) — Inpatient Admission Criteria',
    diagnosisCodes: ['I21.9','I21.01','I21.02','I21.09','I21.11','I21.19','I21.3','I21.4','I22.0','I22.1','I22.8','I22.9','I20.0'],
    scopeSetting: 'INPATIENT',
    scopeRequestType: 'ADMISSION',
    guideline: '2013/2014 ACC/AHA STEMI and NSTEMI Guidelines + 2022 Update',
    guidelineUrl: 'https://doi.org/10.1016/j.jacc.2012.08.012',
    admissionCriteria: `Per ACC/AHA Guidelines, ALL ACS presentations require inpatient admission:
STEMI (mandatory immediate admission + cath lab activation):
  - ST elevation ≥2mm in ≥2 contiguous precordial leads OR ≥1mm in ≥2 contiguous limb leads
  - New or presumably new LBBB with ischemic symptoms
  - Goal: primary PCI within 90 min door-to-balloon (60 min if transferred)
NSTEMI/UA (admission required):
  - Troponin elevation above 99th percentile of normal reference range
  - Dynamic ST changes (≥0.5mm depression or transient elevation)
  - High-risk TIMI score ≥3 or GRACE score >140
Killip classification determines ICU vs telemetry:
  - Killip I: No HF signs — telemetry
  - Killip II: S3, rales <50% lung fields — step-down
  - Killip III: Pulmonary edema (rales >50%) — ICU
  - Killip IV: Cardiogenic shock — ICU + IABP consideration
Contraindications to discharge from ED: ongoing chest pain, hemodynamic instability, high-risk ECG findings, elevated troponin`,
  },
  {
    id: 'INTERNAL-STROKE-INPATIENT-v1',
    title: 'Acute Ischemic Stroke / TIA — Inpatient Admission Criteria',
    diagnosisCodes: ['I63.9','I63.00','I63.10','I63.20','I63.30','I63.40','I63.50','G45.9','G45.0','G45.1','I61.9'],
    scopeSetting: 'INPATIENT',
    scopeRequestType: 'ADMISSION',
    guideline: '2019 AHA/ASA Guidelines for Early Management of Acute Ischemic Stroke',
    guidelineUrl: 'https://doi.org/10.1161/STR.0000000000000211',
    admissionCriteria: `Per AHA/ASA 2019 Guidelines:
ACUTE ISCHEMIC STROKE: All confirmed acute ischemic strokes require immediate inpatient admission to a stroke unit or ICU.
  - IV tPA eligibility window: within 3-4.5 hours of symptom onset (NIHSS ≥4, no contraindications)
  - Mechanical thrombectomy window: large vessel occlusion within 6-24 hours
  - Continuous monitoring required: BP, cardiac rhythm, glucose, neurological status q1-4h
  - BP management: maintain <180/105 if not thrombolysis candidate; <185/110 pre-tPA
TIA (High-risk — inpatient admission required):
  - ABCD2 score ≥4: Age≥60(1), SBP≥140(1), Clinical features (1-2), Duration ≥10min (1-2), Diabetes(1)
  - ABCD2 score ≥4 OR atrial fibrillation OR symptomatic carotid stenosis ≥50%
  - All TIA within 72 hours requiring urgent workup (MRI/MRA, cardiac monitoring, lipids)
Stroke unit admission required for: all ischemic strokes, all ICH, high-risk TIA (ABCD2≥4)
ICU criteria: depressed consciousness (GCS ≤12), hemodynamic instability, respiratory compromise, large territory infarct with malignant edema risk`,
  },
  {
    id: 'INTERNAL-HIP-INPATIENT-v1',
    title: 'Hip Fracture / Total Hip Replacement — Inpatient Admission Criteria',
    diagnosisCodes: ['S72.001A','S72.002A','S72.009A','S72.011A','S72.012A','S72.019A','M16.11','M16.12','M16.31','M16.32'],
    scopeSetting: 'INPATIENT',
    scopeRequestType: 'ADMISSION',
    guideline: 'AAOS Clinical Practice Guidelines on Hip Fracture (2021) + CMS Coverage Policy',
    guidelineUrl: 'https://www.aaos.org/quality/quality-programs/fracture-care-programs/hip-fracture/',
    admissionCriteria: `Per AAOS 2021 Guidelines and CMS policy:
HIP FRACTURE (trauma): All displaced/unstable hip fractures require inpatient surgical admission.
  - Femoral neck fracture (Garden III-IV): total hip arthroplasty or hemiarthroplasty
  - Intertrochanteric fracture: intramedullary nail fixation
  - Timing: Surgery within 24-48 hours of admission reduces mortality and complications
  - Medical optimization may delay up to 72 hours: anticoagulation reversal, cardiac optimization
ELECTIVE TOTAL HIP REPLACEMENT: Inpatient admission (vs outpatient) required when ANY:
  - BMI >40 or BMI >35 with OSA or significant cardiac/pulmonary disease
  - ASA physical status class III or IV
  - Complex anatomy requiring extended OR time >3 hours
  - Anticipated blood loss requiring transfusion
  - Age >80 with significant comorbidities
  - No qualified support at home for outpatient recovery
  - Prior contralateral THA within 6 months
Post-op admission criteria: continuous vital sign monitoring, pain management, DVT prophylaxis, PT/OT initiation, hemoglobin monitoring`,
  },
  {
    id: 'INTERNAL-AFIB-INPATIENT-v1',
    title: 'Atrial Fibrillation — Inpatient Admission Criteria',
    diagnosisCodes: ['I48.0','I48.11','I48.19','I48.20','I48.21','I48.11','I48.9','I48.91','I48.92'],
    scopeSetting: 'INPATIENT',
    scopeRequestType: 'ADMISSION',
    guideline: '2023 ACC/AHA/ACCP/HRS Guideline for Diagnosis and Management of Atrial Fibrillation',
    guidelineUrl: 'https://doi.org/10.1016/j.jacc.2023.08.017',
    admissionCriteria: `Per 2023 ACC/AHA/ACCP/HRS AFib Guidelines, inpatient admission is indicated when ANY of:
1. Hemodynamic instability: SBP <90 mmHg, severe symptoms (chest pain, syncope, severe dyspnea) requiring urgent rate/rhythm control
2. Rapid ventricular response (RVR): HR >150 bpm with hemodynamic compromise or symptoms not controlled with IV rate control
3. Acute decompensated heart failure precipitated by AFib
4. Pre-excitation AFib (WPW): life-threatening, requires immediate cardioversion
5. New-onset AFib within 48 hours: eligible for cardioversion — inpatient rhythm monitoring required
6. Stroke/TIA in setting of AFib: requires inpatient anticoagulation initiation and monitoring
7. Thromboembolic risk requiring bridging: CHA₂DS₂-VASc ≥2 (men) or ≥3 (women) with planned procedure
CHA₂DS₂-VASc scoring: CHF(1), HTN(1), Age≥75(2), Diabetes(1), Stroke/TIA(2), Vascular disease(1), Age65-74(1), Sex female(1)
Rate control targets: HR <80 bpm at rest, <110 bpm during moderate exercise
Rhythm control indication: symptomatic AFib, young patients, tachycardia-induced cardiomyopathy`,
  },
  {
    id: 'INTERNAL-DIABETIC-CRISIS-INPATIENT-v1',
    title: 'Diabetic Ketoacidosis (DKA) / Hyperglycemic Hyperosmolar State — Inpatient Criteria',
    diagnosisCodes: ['E11.10','E11.11','E10.10','E10.11','E11.00','E11.01','E11.641','E10.641','E10.649'],
    scopeSetting: 'INPATIENT',
    scopeRequestType: 'ADMISSION',
    guideline: 'ADA 2023 Standards of Diabetes Care + ADA/EASD DKA/HHS Consensus Statement',
    guidelineUrl: 'https://diabetesjournals.org/care/article/46/Supplement_1/S1/148056/Standards-of-Medical-Care-in-Diabetes-2023',
    admissionCriteria: `Per ADA 2023 Standards of Care, inpatient admission required for:
DKA Diagnostic Criteria (all three required):
  - Blood glucose >250 mg/dL (>13.9 mmol/L)
  - Serum bicarbonate <18 mEq/L OR venous pH <7.3
  - Serum/urine ketones positive
DKA Severity → Admission Level:
  - Mild DKA (pH 7.25-7.30, HCO3 15-18): General medical floor
  - Moderate DKA (pH 7.00-7.24, HCO3 10-14): Step-down or ICU
  - Severe DKA (pH <7.00, HCO3 <10): ICU mandatory
HHS (Hyperglycemic Hyperosmolar State):
  - Blood glucose >600 mg/dL
  - Serum osmolality >320 mOsm/kg
  - Profound dehydration, altered consciousness → ICU
Admission protocol: IV insulin drip, hourly glucose monitoring, potassium replacement (maintain K+ 3.5-5.0 mEq/L before insulin), fluid resuscitation 1L NS in first hour, cardiac monitoring
Discharge criteria: DKA resolution: glucose <200 mg/dL AND two of (HCO3 ≥15, pH >7.3, anion gap ≤12) AND tolerating oral intake AND able to give SC insulin`,
  },
  {
    id: 'INTERNAL-PYELONEPHRITIS-INPATIENT-v1',
    title: 'Complicated UTI / Acute Pyelonephritis — Inpatient Admission Criteria',
    diagnosisCodes: ['N10','N11.9','N12','N39.0','A41.51','N13.6','N20.9'],
    scopeSetting: 'INPATIENT',
    scopeRequestType: 'ADMISSION',
    guideline: 'IDSA Clinical Practice Guidelines for UTI (CID 2011 + 2023 Update)',
    guidelineUrl: 'https://doi.org/10.1093/cid/cir102',
    admissionCriteria: `Per IDSA UTI Guidelines 2011/2023, inpatient admission for UTI/pyelonephritis is indicated when ANY of:
1. Signs of sepsis/systemic infection: fever >38.5°C with chills/rigors, hypotension (SBP <90), tachycardia (HR >100), altered mental status
2. Inability to maintain oral hydration or take oral medications (nausea/vomiting)
3. Complicated UTI features requiring IV management:
   - Obstruction (hydronephrosis, nephrolithiasis with obstruction) — requires urology
   - Perinephric/renal abscess
   - Emphysematous pyelonephritis (gas-forming organisms, especially in diabetics)
   - Urinary catheter/stent with bacteremia
4. Functional or anatomic urinary tract abnormality (reflux, neurogenic bladder, transplant kidney)
5. Immunocompromised state: transplant, HIV, chemotherapy, chronic corticosteroids
6. Pregnancy with pyelonephritis (all require admission)
7. Failure of outpatient oral antibiotics (>48-72 hours therapy without improvement)
8. Elderly (>65) with high-risk comorbidities: diabetes, renal insufficiency (CrCl <30), liver disease
IV antibiotics: ceftriaxone 1g q24h, piperacillin-tazobactam 3.375g q6h, or carbapenem if MDR risk
Step-down to oral when: afebrile >24h, tolerating PO, culture sensitivity available`,
  },
];

// ---------------------------------------------------------------------------
// DSL schema description (used in Claude prompt)
// ---------------------------------------------------------------------------

const DSL_SCHEMA = `{
  "id": "string (unique node id, e.g. 'root' or 'dx-1')",
  "type": "AND" | "OR" | "LEAF",
  "label": "Human-readable criterion name",
  "description": "Optional clarifying detail",
  "required": true | false,
  "dataType": "vital" | "lab" | "diagnosis" | "procedure" | "coverage" | "clinical_note",
  "threshold": {
    "operator": ">" | "<" | ">=" | "<=" | "==" | "in",
    "value": <number | string | string[]>,
    "unit": "optional unit string",
    "loinc": "optional LOINC code",
    "display": "human-readable value label"
  },
  "cqlExpression": "optional CQL expression name",
  "clinicalNotes": "optional free-text note",
  "children": [ ...nested TreeNodes for AND/OR nodes ]
}`;

// ---------------------------------------------------------------------------
// HTML stripping (reused from CMS script pattern)
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Claude via Bedrock (same lazy-init pattern as CMS script)
// ---------------------------------------------------------------------------

let _bedrockClient: InstanceType<typeof import('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient> | null = null;
let _ConverseCommand: typeof import('@aws-sdk/client-bedrock-runtime').ConverseCommand | null = null;

function getBedrockClient() {
  if (_bedrockClient && _ConverseCommand) {
    return { client: _bedrockClient, ConverseCommand: _ConverseCommand };
  }
  const requireBackend = createRequire(
    resolve(ROOT, 'packages/backend/node_modules/@aws-sdk/client-bedrock-runtime/package.json'),
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bedrockMod = requireBackend('@aws-sdk/client-bedrock-runtime') as typeof import('@aws-sdk/client-bedrock-runtime');
  _ConverseCommand = bedrockMod.ConverseCommand;
  _bedrockClient = new bedrockMod.BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
  });
  return { client: _bedrockClient, ConverseCommand: _ConverseCommand };
}

/**
 * Build the Claude prompt for a clinical guideline entry.
 * The prompt includes the full guideline text and instructs Claude to produce
 * a structured DSL criteria tree for inpatient admission review.
 */
function buildGuidelinePrompt(g: GuidelineCriteria): string {
  return `You are a clinical utilization management expert. Convert these published clinical guidelines into a structured coverage criteria decision tree for automated inpatient admission review.

POLICY TITLE: ${g.title}
POLICY TYPE: INTERNAL (payer-defined, evidence-based)
GUIDELINE SOURCE: ${g.guideline}
DIAGNOSIS CODES: ${g.diagnosisCodes.join(', ')}

PUBLISHED ADMISSION CRITERIA:
${g.admissionCriteria}

Generate a JSON response with these exact fields:

1. "dslJson": AND/OR/LEAF criteria tree using this schema:
${DSL_SCHEMA}

Rules:
- Root: type "AND", id "root", label = policy title
- Separate required criteria (ALL must be met) from alternative criteria (ANY one suffices)
- Each LEAF must have a clear clinical threshold:
  - Labs/vitals: include specific values, units, LOINC codes
  - Diagnosis LEAF: threshold.operator "in", threshold.value = array of ICD-10s
  - Clinical note criteria: dataType "clinical_note"
- Keep the tree actionable — reviewers should be able to check each criterion from the case record
- Include at minimum 5-10 LEAFs covering the key admission criteria

2. "diagnosisCodes": Array of ICD-10-CM codes from the provided list plus any additional relevant codes.

3. "scopeSetting": "INPATIENT"
4. "scopeRequestType": "ADMISSION"

5. "summary": 2-3 sentence summary of when inpatient admission is indicated per this guideline.

Respond with ONLY valid JSON. No explanation, no markdown code blocks, no surrounding text.`;
}

/**
 * Best-effort repair of a truncated JSON object from Claude.
 * Mirrors the approach in generate-criteria-from-cms.ts.
 */
function repairTruncatedJson(raw: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};

  const ssMatch = raw.match(/"scopeSetting"\s*:\s*"([A-Z_]+)"/);
  if (ssMatch) result['scopeSetting'] = ssMatch[1];

  const srtMatch = raw.match(/"scopeRequestType"\s*:\s*"([A-Z_]+)"/);
  if (srtMatch) result['scopeRequestType'] = srtMatch[1];

  const sumMatch = raw.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)["\\]?/);
  if (sumMatch) result['summary'] = sumMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');

  const dxMatch = raw.match(/"diagnosisCodes"\s*:\s*(\[[\s\S]*?(?:\]|(?="[a-z])|\n\n))/);
  if (dxMatch) {
    const arrText = dxMatch[1].replace(/,?\s*$/, '') + (dxMatch[1].trim().endsWith(']') ? '' : ']');
    try {
      result['diagnosisCodes'] = JSON.parse(arrText);
    } catch {
      const codes = [...raw.matchAll(/"([A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?)"(?=\s*[,\]])/g)].map(m => m[1]);
      if (codes.length > 0) result['diagnosisCodes'] = codes;
    }
  }

  const dslStart = raw.indexOf('"dslJson"');
  if (dslStart !== -1) {
    const braceStart = raw.indexOf('{', dslStart + 9);
    if (braceStart !== -1) {
      let depth = 0;
      let end = -1;
      for (let i = braceStart; i < raw.length; i++) {
        if (raw[i] === '{') depth++;
        else if (raw[i] === '}') {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      const dslRaw = end !== -1 ? raw.slice(braceStart, end + 1) : raw.slice(braceStart);
      try {
        result['dslJson'] = JSON.parse(dslRaw);
      } catch {
        const labelMatch = raw.match(/"label"\s*:\s*"([^"]+)"/);
        result['dslJson'] = {
          id: 'root',
          type: 'AND',
          label: labelMatch?.[1] ?? 'Coverage Criteria',
          required: true,
          dataType: 'coverage',
          children: [],
          clinicalNotes: 'Criteria tree truncated — re-run to regenerate',
        };
      }
    }
  }

  if (result['scopeSetting'] && result['summary']) return result;
  return null;
}

/** Call Bedrock with the guideline prompt and parse the CriteriaResult JSON. */
async function callClaude(prompt: string): Promise<CriteriaResult | null> {
  const { client: bedrockClient, ConverseCommand } = getBedrockClient();
  try {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6',
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 16000, temperature: 0.1 },
      }),
    );

    const text: string = response.output?.message?.content?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`  Claude returned no JSON object. Raw (first 300):\n  ${text.slice(0, 300)}`);
      return null;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      const repaired = repairTruncatedJson(jsonMatch[0]);
      if (repaired) {
        console.warn(`  Warning: JSON truncated — partial repair (${Object.keys(repaired).join(', ')})`);
        parsed = repaired;
      } else {
        console.error(`  JSON parse error: ${parseErr instanceof Error ? parseErr.message : parseErr}`);
        console.error(`  Raw JSON snippet: ${jsonMatch[0].slice(0, 300)}`);
        return null;
      }
    }

    const validScopeSettings = ['INPATIENT', 'OUTPATIENT', 'DME', 'HOME_HEALTH'] as const;
    const validRequestTypes = ['ADMISSION', 'CONTINUED_STAY', 'PROCEDURE', 'SERVICE', 'MEDICATION', 'DME'] as const;

    const scopeSetting = validScopeSettings.includes(parsed.scopeSetting as typeof validScopeSettings[number])
      ? (parsed.scopeSetting as CriteriaResult['scopeSetting'])
      : 'INPATIENT'; // guidelines are all INPATIENT — safe default

    const scopeRequestType = validRequestTypes.includes(parsed.scopeRequestType as typeof validRequestTypes[number])
      ? (parsed.scopeRequestType as CriteriaResult['scopeRequestType'])
      : 'ADMISSION';

    // Normalize diagnosisCodes: Claude sometimes returns objects like {code, description}
    // instead of plain strings. Extract the code string regardless of shape.
    const rawDx = Array.isArray(parsed.diagnosisCodes) ? parsed.diagnosisCodes : [];
    const diagnosisCodes: string[] = rawDx
      .map((entry: unknown) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          const obj = entry as Record<string, unknown>;
          // Accept any of: code, icd10Code, icd_code, value
          const code = obj['code'] ?? obj['icd10Code'] ?? obj['icd_code'] ?? obj['value'] ?? '';
          return typeof code === 'string' ? code : '';
        }
        return '';
      })
      .filter((c: string) => c.length > 0);

    return {
      dslJson: (parsed.dslJson as object) ?? {},
      diagnosisCodes,
      scopeSetting,
      scopeRequestType,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    };
  } catch (err) {
    console.error(`  Claude/Bedrock error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Generate criteria tree for a single guideline entry. */
async function generateCriteriaForGuideline(g: GuidelineCriteria): Promise<CriteriaResult | null> {
  const prompt = buildGuidelinePrompt(g);
  return callClaude(prompt);
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

function getDb() {
  const require = createRequire(
    resolve(ROOT, 'packages/backend/node_modules/knex/package.json'),
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const knex = require('knex') as typeof import('knex').default;

  return knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 13306),
      user: process.env.DB_USER ?? 'document_ai_admin',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'lucidreview',
      timezone: 'UTC',
    },
    pool: { min: 1, max: 3 },
  });
}

type DbInstance = ReturnType<typeof getDb>;

/**
 * Upsert an INTERNAL guideline-based policy + criteria_set into the DB.
 *
 * Key differences from upsertNcdToDb:
 * - policy_type is 'INTERNAL'
 * - cms_id is null — lookup is by criteria_set_id instead
 * - status is set to 'ACTIVE' immediately (published guidelines, no human review gate)
 * - Existing ACTIVE records are skipped unless --force flag is passed
 */
async function upsertGuidelineToDb(
  db: DbInstance,
  g: GuidelineCriteria,
  criteria: CriteriaResult,
  force: boolean = false,
): Promise<{ action: 'created' | 'updated' | 'skipped'; policyId: string }> {
  // The criteria_set_id doubles as the stable external key for INTERNAL policies.
  const criteriaSetId = g.id; // e.g. 'INTERNAL-CHF-INPATIENT-v1'

  // Check for an existing criteria_set with this id to locate the linked policy.
  const existingCs = await db('criteria_sets')
    .where({ criteria_set_id: criteriaSetId })
    .first<{ id: string; policy_id: string; status: string } | undefined>();

  const sectionsJson = {
    summary: criteria.summary,
    guideline: g.guideline,
    guidelineUrl: g.guidelineUrl,
    diagnosisCodes: criteria.diagnosisCodes,
    admissionCriteria: g.admissionCriteria.slice(0, 2000),
  };

  let policyId: string;
  let action: 'created' | 'updated';

  if (existingCs) {
    policyId = existingCs.policy_id;

    // Skip non-DRAFT criteria_sets unless --force was passed
    if (existingCs.status !== 'DRAFT' && !force) {
      return { action: 'skipped', policyId };
    }

    // Update the linked policy record
    await db('policies').where({ id: policyId }).update({
      title: g.title,
      sections_json: JSON.stringify(sectionsJson),
      source_url: g.guidelineUrl,
      updated_at: new Date(),
    });

    // Update the criteria_set (re-activate if it was DRAFT)
    await db('criteria_sets').where({ criteria_set_id: criteriaSetId }).update({
      dsl_json: JSON.stringify(criteria.dslJson),
      scope_setting: criteria.scopeSetting,
      scope_request_type: criteria.scopeRequestType,
      status: 'ACTIVE',
      updated_at: new Date(),
    });

    action = 'updated';
  } else {
    // No existing record — create policy then criteria_set
    policyId = randomUUID();

    await db('policies').insert({
      id: policyId,
      policy_type: 'INTERNAL',
      cms_id: null,
      title: g.title,
      status: 'ACTIVE',
      effective_date: new Date().toISOString().slice(0, 10),
      source_url: g.guidelineUrl,
      sections_json: JSON.stringify(sectionsJson),
      created_at: new Date(),
      updated_at: new Date(),
    });

    await db('criteria_sets').insert({
      id: randomUUID(),
      criteria_set_id: criteriaSetId,
      policy_id: policyId,
      title: `${g.title} — Coverage Criteria`,
      scope_setting: criteria.scopeSetting,
      scope_request_type: criteria.scopeRequestType,
      dsl_json: JSON.stringify(criteria.dslJson),
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    });

    action = 'created';
  }

  return { action, policyId };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun  = args.includes('--dry-run');
  const force   = args.includes('--force');
  const idIdx   = args.indexOf('--id');
  const targetId = idIdx !== -1 ? args[idIdx + 1] : null;

  console.log('================================================================');
  console.log('Clinical Guideline → INTERNAL Criteria Generator');
  console.log('================================================================');
  console.log(`Mode    : ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
  console.log(`Force   : ${force ? 'yes (will overwrite ACTIVE records)' : 'no'}`);
  console.log(`Filter  : ${targetId ?? '(all 10 diagnoses)'}`);
  console.log(`Model   : ${process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6'}`);
  console.log(`Region  : ${process.env.AWS_REGION ?? 'us-east-1'}`);
  if (!dryRun) {
    console.log(`Database: ${process.env.DB_USER ?? 'document_ai_admin'}@${process.env.DB_HOST ?? '127.0.0.1'}:${process.env.DB_PORT ?? 13306}/${process.env.DB_NAME ?? 'lucidreview'}`);
  }
  console.log('');

  // Apply --id filter
  const guidelines = targetId
    ? GUIDELINES.filter(g => g.id === targetId)
    : GUIDELINES;

  if (guidelines.length === 0) {
    console.error(`No guideline found with id "${targetId}".`);
    console.error(`Available ids:\n  ${GUIDELINES.map(g => g.id).join('\n  ')}`);
    process.exit(1);
  }

  const db = dryRun ? null : getDb();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors  = 0;

  for (let i = 0; i < guidelines.length; i++) {
    const g = guidelines[i]!;
    const progress = `[${String(i + 1).padStart(String(guidelines.length).length, ' ')}/${guidelines.length}]`;
    console.log(`${progress} ${g.id}`);
    console.log(`         ${g.title}`);
    console.log(`         Guideline: ${g.guideline}`);

    const criteria = await generateCriteriaForGuideline(g);

    if (!criteria) {
      console.log(`         FAILED: Claude generation returned null`);
      errors++;
    } else {
      const dslPreview = JSON.stringify(criteria.dslJson).slice(0, 120);
      console.log(`         scope      : ${criteria.scopeSetting} / ${criteria.scopeRequestType}`);
      console.log(`         ICD-10     : [${criteria.diagnosisCodes.slice(0, 6).join(', ')}${criteria.diagnosisCodes.length > 6 ? `, +${criteria.diagnosisCodes.length - 6} more` : ''}]`);
      console.log(`         summary    : ${criteria.summary.slice(0, 120)}`);
      console.log(`         dsl preview: ${dslPreview}${dslPreview.length >= 120 ? '...' : ''}`);

      if (!dryRun && db) {
        try {
          const result = await upsertGuidelineToDb(db, g, criteria, force);
          console.log(`         DB         : ${result.action} (policy ${result.policyId})`);
          if (result.action === 'created') created++;
          else if (result.action === 'updated') updated++;
          else skipped++;
        } catch (dbErr) {
          console.error(`         DB error   : ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
          errors++;
        }
      } else if (dryRun) {
        console.log(`         DB         : (dry-run — skipped)`);
      }
    }

    console.log('');

    // Throttle between calls to avoid Bedrock rate limits
    if (i < guidelines.length - 1) {
      await new Promise<void>((r) => setTimeout(r, 1200));
    }
  }

  if (db) await db.destroy();

  console.log('================================================================');
  console.log('Summary');
  console.log('================================================================');
  if (dryRun) {
    console.log('(DRY RUN — nothing written to database)');
    console.log(`Processed : ${guidelines.length} guidelines`);
    console.log(`Errors    : ${errors}`);
  } else {
    console.log(`Created   : ${created}`);
    console.log(`Updated   : ${updated}`);
    console.log(`Skipped   : ${skipped} (ACTIVE records not overwritten — use --force to override)`);
    console.log(`Errors    : ${errors}`);
    console.log(`Total     : ${created + updated + skipped + errors}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
