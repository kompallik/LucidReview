/**
 * Mock UM adapter returning realistic data for case ARF-2026-001
 * (Acute Respiratory Failure thin-slice test case).
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

const now = new Date().toISOString();
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

const MOCK_CASE: UmCaseData = {
  caseNumber: 'ARF-2026-001',
  memberId: 'MBR-123456',
  status: 'PENDING_REVIEW',
  urgency: 'URGENT',
  serviceType: 'Inpatient Admission',
  requestDate: sixHoursAgo,
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

const MOCK_CLINICAL_INFO: UmClinicalData = {
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
    { type: 'SpO2', value: 87, unit: '%', observedAt: twoHoursAgo },
    { type: 'Respiratory Rate', value: 28, unit: 'breaths/min', observedAt: twoHoursAgo },
    { type: 'Heart Rate', value: 110, unit: 'bpm', observedAt: twoHoursAgo },
    { type: 'Temperature', value: 38.2, unit: '°C', observedAt: twoHoursAgo },
  ],
  labs: [
    { name: 'pO2', value: 55, unit: 'mmHg', loincCode: '2703-7', collectedAt: twoHoursAgo },
    { name: 'pCO2', value: 52, unit: 'mmHg', loincCode: '2019-8', collectedAt: twoHoursAgo },
    { name: 'pH', value: 7.31, unit: '', loincCode: '2744-1', collectedAt: twoHoursAgo },
    { name: 'WBC', value: 14.2, unit: '10^3/uL', loincCode: '6690-2', collectedAt: fourHoursAgo },
    { name: 'Lactate', value: 2.8, unit: 'mmol/L', loincCode: '2524-7', collectedAt: twoHoursAgo },
  ],
};

const MOCK_ATTACHMENTS: UmAttachment[] = [
  {
    attachmentId: 'ATT-001',
    fileName: 'ED_Physician_Note.pdf',
    mimeType: 'application/pdf',
    category: 'CLINICAL_NOTE',
    uploadDate: fourHoursAgo,
    fileSizeBytes: 45_200,
  },
  {
    attachmentId: 'ATT-002',
    fileName: 'ABG_Results.pdf',
    mimeType: 'application/pdf',
    category: 'LAB_RESULT',
    uploadDate: twoHoursAgo,
    fileSizeBytes: 12_800,
  },
];

// Realistic clinical content encoded as base64 (mock PDF text)
const ED_NOTE_TEXT = `EMERGENCY DEPARTMENT PHYSICIAN NOTE

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

const ABG_RESULTS_TEXT = `ARTERIAL BLOOD GAS RESULTS

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

const MOCK_ATTACHMENT_CONTENT: Record<
  string,
  { base64Content: string; mimeType: string; fileName: string }
> = {
  'ATT-001': {
    base64Content: Buffer.from(ED_NOTE_TEXT).toString('base64'),
    mimeType: 'application/pdf',
    fileName: 'ED_Physician_Note.pdf',
  },
  'ATT-002': {
    base64Content: Buffer.from(ABG_RESULTS_TEXT).toString('base64'),
    mimeType: 'application/pdf',
    fileName: 'ABG_Results.pdf',
  },
};

const MOCK_CASE_HISTORY: UmHistoryEntry[] = [
  {
    timestamp: sixHoursAgo,
    action: 'CASE_CREATED',
    actor: 'System',
    notes: 'Case submitted via electronic authorization request',
  },
  {
    timestamp: fourHoursAgo,
    action: 'DOCUMENTS_ATTACHED',
    actor: 'Dr. Sarah Chen',
    actorRole: 'Requesting Provider',
    notes: 'ED physician note and ABG results uploaded',
  },
  {
    timestamp: now,
    action: 'REVIEW_INITIATED',
    actor: 'System',
    notes: 'Case assigned for AI-assisted review',
  },
];

const MOCK_CASE_NOTES: UmCaseNote[] = [
  {
    noteId: 'NOTE-001',
    author: 'Dr. Sarah Chen',
    authorRole: 'Requesting Provider',
    timestamp: fourHoursAgo,
    text: 'Patient requires urgent inpatient admission for acute respiratory failure. SpO2 87% on room air, requiring BiPAP and IV steroids. Not safe for outpatient management.',
    noteType: 'CLINICAL',
  },
  {
    noteId: 'NOTE-002',
    author: 'Registration Staff',
    authorRole: 'Administrative',
    timestamp: sixHoursAgo,
    text: 'Medicare Part A coverage verified. Patient has active coverage through MBR-123456.',
    noteType: 'ADMINISTRATIVE',
  },
];

const MOCK_MEMBER_COVERAGE: UmCoverageData = {
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

export class MockUmAdapter {
  async getCase(caseNumber: string): Promise<UmCaseData> {
    if (caseNumber !== 'ARF-2026-001') {
      throw new Error(`Mock: case ${caseNumber} not found`);
    }
    return MOCK_CASE;
  }

  async getClinicalInfo(caseNumber: string): Promise<UmClinicalData> {
    if (caseNumber !== 'ARF-2026-001') {
      throw new Error(`Mock: case ${caseNumber} not found`);
    }
    return MOCK_CLINICAL_INFO;
  }

  async getAttachments(caseNumber: string): Promise<UmAttachment[]> {
    if (caseNumber !== 'ARF-2026-001') {
      throw new Error(`Mock: case ${caseNumber} not found`);
    }
    return MOCK_ATTACHMENTS;
  }

  async downloadAttachment(
    caseNumber: string,
    attachmentId: string,
  ): Promise<{ base64Content: string; mimeType: string; fileName: string }> {
    if (caseNumber !== 'ARF-2026-001') {
      throw new Error(`Mock: case ${caseNumber} not found`);
    }
    const content = MOCK_ATTACHMENT_CONTENT[attachmentId];
    if (!content) {
      throw new Error(`Mock: attachment ${attachmentId} not found`);
    }
    return content;
  }

  async getCaseHistory(caseNumber: string): Promise<UmHistoryEntry[]> {
    if (caseNumber !== 'ARF-2026-001') {
      throw new Error(`Mock: case ${caseNumber} not found`);
    }
    return MOCK_CASE_HISTORY;
  }

  async getCaseNotes(caseNumber: string): Promise<UmCaseNote[]> {
    if (caseNumber !== 'ARF-2026-001') {
      throw new Error(`Mock: case ${caseNumber} not found`);
    }
    return MOCK_CASE_NOTES;
  }

  async getMemberCoverage(memberId: string): Promise<UmCoverageData> {
    if (memberId !== 'MBR-123456') {
      throw new Error(`Mock: member ${memberId} not found`);
    }
    return MOCK_MEMBER_COVERAGE;
  }
}
