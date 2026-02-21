import type {
  Review,
  ReviewDetail,
  AgentRun,
  AgentTrace,
  DeterminationResult,
  Policy,
} from './client.ts';

// ─── Mock Reviews ─────────────────────────────────────────────────────────────

const now = new Date().toISOString();
const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

export const MOCK_REVIEWS: Review[] = [
  {
    id: 'rev-001',
    caseNumber: 'ARF-2026-001',
    status: 'pending',
    urgency: 'URGENT',
    serviceType: 'Inpatient Admission',
    primaryDiagnosisCode: 'J96.00',
    primaryDiagnosisDisplay: 'Acute respiratory failure, unspecified',
    createdAt: hourAgo,
    updatedAt: hourAgo,
  },
  {
    id: 'rev-002',
    caseNumber: 'ARF-2026-002',
    status: 'in_review',
    determination: 'AUTO_APPROVE',
    urgency: 'STANDARD',
    serviceType: 'Inpatient Admission',
    primaryDiagnosisCode: 'J96.01',
    primaryDiagnosisDisplay: 'Acute respiratory failure with hypoxia',
    latestRunId: 'run-002',
    createdAt: dayAgo,
    updatedAt: hourAgo,
  },
  {
    id: 'rev-003',
    caseNumber: 'ARF-2026-003',
    status: 'decided',
    determination: 'MD_REVIEW',
    urgency: 'URGENT',
    serviceType: 'Inpatient Admission',
    primaryDiagnosisCode: 'J96.00',
    primaryDiagnosisDisplay: 'Acute respiratory failure, unspecified',
    latestRunId: 'run-003',
    decidedAt: hourAgo,
    createdAt: dayAgo,
    updatedAt: hourAgo,
  },
  {
    id: 'rev-004',
    caseNumber: 'PNE-2026-001',
    status: 'pending',
    urgency: 'STANDARD',
    serviceType: 'Inpatient Admission',
    primaryDiagnosisCode: 'J18.9',
    primaryDiagnosisDisplay: 'Pneumonia, unspecified organism',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'rev-005',
    caseNumber: 'CHF-2026-001',
    status: 'in_review',
    urgency: 'URGENT',
    serviceType: 'Inpatient Admission',
    primaryDiagnosisCode: 'I50.9',
    primaryDiagnosisDisplay: 'Heart failure, unspecified',
    latestRunId: 'run-005',
    createdAt: dayAgo,
    updatedAt: now,
  },
];

// ─── Mock Agent Run ───────────────────────────────────────────────────────────

export const MOCK_DETERMINATION: DeterminationResult = {
  decision: 'AUTO_APPROVE',
  confidence: 0.95,
  rationale:
    'Patient John Doe (68M) presents with acute respiratory failure (J96.00) with documented hypoxia ' +
    '(SpO2 87% at 08:15, well below 90% threshold). Structured data confirms diagnosis and supporting ' +
    'lab values including ABG showing PaO2 of 55 mmHg. All admission criteria for acute respiratory ' +
    'failure are met per NCD 240.0. Recommend auto-approval.',
  policyBasis: [
    { policyId: 'pol-001', title: 'NCD 240.0 — Acute Respiratory Failure Inpatient Admission', version: '2025-01' },
  ],
  criteriaResults: [
    {
      criterionId: 'crit-001',
      criterionName: 'Has Acute Respiratory Failure Diagnosis',
      result: 'MET',
      evidence: 'ICD-10 J96.00 — Acute respiratory failure, unspecified',
      fhirReference: 'Condition/arf-001',
      source: 'STRUCTURED',
    },
    {
      criterionId: 'crit-002',
      criterionName: 'Recent O2 Saturation < 90%',
      result: 'MET',
      evidence: 'SpO2 87% recorded at 08:15 today (within 6-hour lookback)',
      fhirReference: 'Observation/spo2-001',
      value: '87%',
      observedAt: new Date(Date.now() - 7_200_000).toISOString(),
      source: 'STRUCTURED',
    },
    {
      criterionId: 'crit-003',
      criterionName: 'ABG PaO2 < 60 mmHg',
      result: 'MET',
      evidence: 'PaO2 55 mmHg from arterial blood gas',
      fhirReference: 'Observation/abg-001',
      value: '55 mmHg',
      observedAt: new Date(Date.now() - 5_400_000).toISOString(),
      source: 'STRUCTURED',
    },
    {
      criterionId: 'crit-004',
      criterionName: 'Requires Supplemental Oxygen or Ventilatory Support',
      result: 'MET',
      evidence: 'Patient intubated and on mechanical ventilation per clinical notes',
      fhirReference: 'Procedure/vent-001',
      source: 'NLP',
    },
    {
      criterionId: 'crit-005',
      criterionName: 'Inpatient Level of Care Required',
      result: 'MET',
      evidence: 'ICU admission with continuous monitoring, meets inpatient criteria',
      source: 'STRUCTURED',
    },
  ],
  clinicalSummary: [
    { category: 'Diagnosis', code: 'J96.00', codeSystem: 'ICD-10-CM', display: 'Acute respiratory failure, unspecified', source: 'STRUCTURED' },
    { category: 'Diagnosis', code: 'J18.9', codeSystem: 'ICD-10-CM', display: 'Pneumonia, unspecified organism', source: 'NLP' },
    { category: 'Vital Signs', code: '59408-5', codeSystem: 'LOINC', display: 'Oxygen saturation (SpO2)', value: '87', unit: '%', date: new Date(Date.now() - 7_200_000).toISOString(), source: 'STRUCTURED' },
    { category: 'Lab Result', code: '2703-7', codeSystem: 'LOINC', display: 'PaO2 (Arterial Blood Gas)', value: '55', unit: 'mmHg', date: new Date(Date.now() - 5_400_000).toISOString(), source: 'STRUCTURED' },
    { category: 'Lab Result', code: '2744-1', codeSystem: 'LOINC', display: 'pH (Arterial Blood Gas)', value: '7.28', unit: '', date: new Date(Date.now() - 5_400_000).toISOString(), source: 'STRUCTURED' },
    { category: 'Procedure', code: '5A1935Z', codeSystem: 'ICD-10-PCS', display: 'Mechanical ventilation, < 24 hours', date: new Date(Date.now() - 3_600_000).toISOString(), source: 'STRUCTURED' },
    { category: 'Medication', display: 'Albuterol 2.5mg nebulizer Q4H', source: 'NLP' },
    { category: 'Provider', display: 'Dr. Sarah Chen, Pulmonology — City General Hospital ICU', source: 'STRUCTURED' },
  ],
  missingData: [],
};

export const MOCK_AGENT_RUN: AgentRun = {
  id: 'run-001',
  caseNumber: 'ARF-2026-001',
  status: 'completed',
  modelId: 'us.anthropic.claude-sonnet-4-20250514',
  totalTurns: 12,
  determination: MOCK_DETERMINATION,
  inputTokensTotal: 24_580,
  outputTokensTotal: 8_120,
  startedAt: new Date(Date.now() - 120_000).toISOString(),
  completedAt: new Date(Date.now() - 30_000).toISOString(),
};

// ─── Mock Agent Trace ─────────────────────────────────────────────────────────

export const MOCK_TRACE: AgentTrace = {
  turns: [
    {
      turn: {
        id: 't-001',
        runId: 'run-001',
        turnNumber: 0,
        role: 'assistant',
        content: 'I\'ll begin reviewing case ARF-2026-001 by gathering the case information and clinical data.',
        stopReason: 'tool_use',
        inputTokens: 450,
        outputTokens: 85,
        latencyMs: 1200,
        createdAt: new Date(Date.now() - 115_000).toISOString(),
      },
      toolCalls: [
        {
          id: 'tc-001',
          runId: 'run-001',
          turnNumber: 0,
          toolName: 'um_get_case',
          input: { caseNumber: 'ARF-2026-001' },
          output: {
            caseNumber: 'ARF-2026-001',
            patient: { firstName: 'John', lastName: 'Doe', dob: '1958-03-15', memberId: 'MBR-88901' },
            provider: { name: 'Dr. Sarah Chen', npi: '1234567890', specialty: 'Pulmonology' },
            facility: { name: 'City General Hospital', type: 'Acute Care' },
            serviceType: 'Inpatient Admission',
            urgency: 'URGENT',
            requestDate: dayAgo,
          },
          latencyMs: 230,
          createdAt: new Date(Date.now() - 114_000).toISOString(),
        },
      ],
    },
    {
      turn: {
        id: 't-002',
        runId: 'run-001',
        turnNumber: 1,
        role: 'assistant',
        content: 'Case retrieved. Patient is John Doe, 68M. Now fetching clinical information and member coverage.',
        stopReason: 'tool_use',
        inputTokens: 890,
        outputTokens: 120,
        latencyMs: 980,
        createdAt: new Date(Date.now() - 110_000).toISOString(),
      },
      toolCalls: [
        {
          id: 'tc-002',
          runId: 'run-001',
          turnNumber: 1,
          toolName: 'um_get_clinical_info',
          input: { caseNumber: 'ARF-2026-001' },
          output: {
            diagnoses: [
              { code: 'J96.00', system: 'ICD-10-CM', display: 'Acute respiratory failure, unspecified', isPrimary: true },
            ],
            vitals: [
              { code: '59408-5', display: 'SpO2', value: 87, unit: '%', timestamp: new Date(Date.now() - 7_200_000).toISOString() },
            ],
            labs: [
              { code: '2703-7', display: 'PaO2', value: 55, unit: 'mmHg', timestamp: new Date(Date.now() - 5_400_000).toISOString() },
              { code: '2744-1', display: 'pH', value: 7.28, unit: '', timestamp: new Date(Date.now() - 5_400_000).toISOString() },
            ],
          },
          latencyMs: 185,
          createdAt: new Date(Date.now() - 109_000).toISOString(),
        },
        {
          id: 'tc-003',
          runId: 'run-001',
          turnNumber: 1,
          toolName: 'um_get_member_coverage',
          input: { memberId: 'MBR-88901' },
          output: {
            memberId: 'MBR-88901',
            plan: 'Medicare Part A',
            status: 'Active',
            effectiveDate: '2023-01-01',
            terminationDate: null,
          },
          latencyMs: 142,
          createdAt: new Date(Date.now() - 108_500).toISOString(),
        },
        {
          id: 'tc-003b',
          runId: 'run-001',
          turnNumber: 1,
          toolName: 'um_get_case_history',
          input: { caseNumber: 'ARF-2026-001' },
          output: {
            priorCases: [],
            note: 'No prior authorization requests found for this member and diagnosis.',
          },
          latencyMs: 78,
          createdAt: new Date(Date.now() - 108_200).toISOString(),
        },
      ],
    },
    {
      turn: {
        id: 't-003',
        runId: 'run-001',
        turnNumber: 2,
        role: 'assistant',
        content: 'Clinical data shows J96.00 with SpO2 87% and PaO2 55 mmHg. Coverage is active Medicare Part A. No prior auth history. Let me check for attachments and case notes.',
        stopReason: 'tool_use',
        inputTokens: 1650,
        outputTokens: 95,
        latencyMs: 1100,
        createdAt: new Date(Date.now() - 105_000).toISOString(),
      },
      toolCalls: [
        {
          id: 'tc-004',
          runId: 'run-001',
          turnNumber: 2,
          toolName: 'um_get_attachments',
          input: { caseNumber: 'ARF-2026-001' },
          output: [
            { attachmentId: 'att-001', fileName: 'Discharge_Summary.pdf', mimeType: 'application/pdf', category: 'Clinical Notes' },
            { attachmentId: 'att-002', fileName: 'ABG_Results.pdf', mimeType: 'application/pdf', category: 'Lab Results' },
          ],
          latencyMs: 98,
          createdAt: new Date(Date.now() - 104_000).toISOString(),
        },
        {
          id: 'tc-004b',
          runId: 'run-001',
          turnNumber: 2,
          toolName: 'um_get_case_notes',
          input: { caseNumber: 'ARF-2026-001' },
          output: [
            { author: 'Intake Coordinator', timestamp: dayAgo, text: 'Urgent inpatient auth request received from City General Hospital. Patient in ICU with acute respiratory failure.' },
          ],
          latencyMs: 62,
          createdAt: new Date(Date.now() - 103_800).toISOString(),
        },
      ],
    },
    {
      turn: {
        id: 't-004',
        runId: 'run-001',
        turnNumber: 3,
        role: 'assistant',
        content: 'Found 2 PDF attachments. Downloading and extracting text from the discharge summary first.',
        stopReason: 'tool_use',
        inputTokens: 2100,
        outputTokens: 78,
        latencyMs: 850,
        createdAt: new Date(Date.now() - 100_000).toISOString(),
      },
      toolCalls: [
        {
          id: 'tc-005',
          runId: 'run-001',
          turnNumber: 3,
          toolName: 'um_download_attachment',
          input: { caseNumber: 'ARF-2026-001', attachmentId: 'att-001' },
          output: { base64Content: '[base64...]', mimeType: 'application/pdf', fileName: 'Discharge_Summary.pdf' },
          latencyMs: 450,
          createdAt: new Date(Date.now() - 99_000).toISOString(),
        },
        {
          id: 'tc-006',
          runId: 'run-001',
          turnNumber: 3,
          toolName: 'pdf_extract_text',
          input: { base64Content: '[base64...]' },
          output: {
            text: 'DISCHARGE SUMMARY\n\nPatient: John Doe, 68M\nAdmitting Dx: Acute respiratory failure (J96.00)\n\nHPI: Patient presented to ED with severe dyspnea and hypoxia. SpO2 87% on RA. ABG showed PaO2 55, pH 7.28. Patient was intubated and placed on mechanical ventilation...',
            pageCount: 3,
          },
          latencyMs: 1200,
          createdAt: new Date(Date.now() - 97_000).toISOString(),
        },
      ],
    },
    {
      turn: {
        id: 't-005',
        runId: 'run-001',
        turnNumber: 4,
        role: 'assistant',
        content: 'Discharge summary extracted. Running NLP to extract clinical entities from the document text.',
        stopReason: 'tool_use',
        inputTokens: 3200,
        outputTokens: 65,
        latencyMs: 780,
        createdAt: new Date(Date.now() - 93_000).toISOString(),
      },
      toolCalls: [
        {
          id: 'tc-007',
          runId: 'run-001',
          turnNumber: 4,
          toolName: 'nlp_extract_clinical_entities',
          input: { text: 'DISCHARGE SUMMARY\n\nPatient: John Doe, 68M\nAdmitting Dx: Acute respiratory failure...' },
          output: [
            { text: 'acute respiratory failure', type: 'PROBLEM', code: 'J96.00', codeSystem: 'ICD-10-CM', assertion: 'AFFIRMED' },
            { text: 'pneumonia', type: 'PROBLEM', code: 'J18.9', codeSystem: 'ICD-10-CM', assertion: 'AFFIRMED' },
            { text: 'intubated', type: 'PROCEDURE', code: '5A1935Z', codeSystem: 'ICD-10-PCS', assertion: 'AFFIRMED' },
            { text: 'mechanical ventilation', type: 'PROCEDURE', code: '5A1935Z', codeSystem: 'ICD-10-PCS', assertion: 'AFFIRMED' },
            { text: 'albuterol', type: 'MEDICATION', assertion: 'AFFIRMED' },
          ],
          latencyMs: 2800,
          createdAt: new Date(Date.now() - 89_000).toISOString(),
        },
      ],
    },
    {
      turn: {
        id: 't-006',
        runId: 'run-001',
        turnNumber: 5,
        role: 'assistant',
        content: 'NLP confirmed key entities. Now normalizing all data to FHIR for criteria evaluation.',
        stopReason: 'tool_use',
        inputTokens: 4500,
        outputTokens: 72,
        latencyMs: 920,
        createdAt: new Date(Date.now() - 85_000).toISOString(),
      },
      toolCalls: [
        {
          id: 'tc-008',
          runId: 'run-001',
          turnNumber: 5,
          toolName: 'fhir_normalize_case',
          input: { caseNumber: 'ARF-2026-001' },
          output: { patientId: 'patient-001', resourceIds: ['Condition/arf-001', 'Observation/spo2-001', 'Observation/abg-001', 'Procedure/vent-001', 'Coverage/cov-001'] },
          latencyMs: 1500,
          createdAt: new Date(Date.now() - 83_000).toISOString(),
        },
        {
          id: 'tc-008b',
          runId: 'run-001',
          turnNumber: 5,
          toolName: 'fhir_get_patient_summary',
          input: { patientId: 'patient-001' },
          output: {
            patientId: 'patient-001',
            name: 'John Doe',
            birthDate: '1958-03-15',
            gender: 'male',
            conditions: ['Acute respiratory failure (J96.00)', 'Pneumonia (J18.9)'],
            activeMedications: ['Albuterol 2.5mg nebulizer Q4H'],
            recentVitals: { SpO2: '87%', HR: '112 bpm', RR: '28/min', BP: '145/92 mmHg' },
            recentLabs: { PaO2: '55 mmHg', pH: '7.28', PaCO2: '48 mmHg' },
          },
          latencyMs: 320,
          createdAt: new Date(Date.now() - 82_000).toISOString(),
        },
      ],
    },
    {
      turn: {
        id: 't-007',
        runId: 'run-001',
        turnNumber: 6,
        role: 'assistant',
        content: 'FHIR resources created. Looking up applicable coverage policies for J96.00 inpatient admission.',
        stopReason: 'tool_use',
        inputTokens: 5200,
        outputTokens: 82,
        latencyMs: 750,
        createdAt: new Date(Date.now() - 78_000).toISOString(),
      },
      toolCalls: [
        {
          id: 'tc-009',
          runId: 'run-001',
          turnNumber: 6,
          toolName: 'policy_lookup',
          input: { diagnosisCodes: ['J96.00'], serviceType: 'Inpatient Admission' },
          output: {
            policies: [
              { policyId: 'pol-001', title: 'NCD 240.0 — Acute Respiratory Failure Inpatient Admission', cqlLibraryId: 'Library/arf-criteria-v1' },
            ],
          },
          latencyMs: 65,
          createdAt: new Date(Date.now() - 77_000).toISOString(),
        },
      ],
    },
    {
      turn: {
        id: 't-008',
        runId: 'run-001',
        turnNumber: 7,
        role: 'assistant',
        content: 'Found applicable policy NCD 240.0. Evaluating CQL criteria against the patient\'s FHIR data.',
        stopReason: 'tool_use',
        inputTokens: 5800,
        outputTokens: 88,
        latencyMs: 680,
        createdAt: new Date(Date.now() - 73_000).toISOString(),
      },
      toolCalls: [
        {
          id: 'tc-010',
          runId: 'run-001',
          turnNumber: 7,
          toolName: 'cql_evaluate_criteria',
          input: { libraryId: 'Library/arf-criteria-v1', patientId: 'patient-001' },
          output: {
            results: [
              { criterionId: 'crit-001', name: 'Has Acute Respiratory Failure Diagnosis', result: 'MET', evidence: 'ICD-10 J96.00' },
              { criterionId: 'crit-002', name: 'Recent O2 Saturation < 90%', result: 'MET', evidence: 'SpO2 87% at 08:15' },
              { criterionId: 'crit-003', name: 'ABG PaO2 < 60 mmHg', result: 'MET', evidence: 'PaO2 55 mmHg' },
              { criterionId: 'crit-004', name: 'Requires Ventilatory Support', result: 'MET', evidence: 'Mechanical ventilation documented' },
              { criterionId: 'crit-005', name: 'Inpatient Level of Care Required', result: 'MET', evidence: 'ICU admission' },
            ],
            allCriteriaMet: true,
            missingData: [],
          },
          latencyMs: 890,
          createdAt: new Date(Date.now() - 71_000).toISOString(),
        },
      ],
    },
    {
      turn: {
        id: 't-009',
        runId: 'run-001',
        turnNumber: 8,
        role: 'assistant',
        content: 'All 5 criteria are MET. Proposing AUTO_APPROVE determination.',
        stopReason: 'tool_use',
        inputTokens: 6800,
        outputTokens: 55,
        latencyMs: 620,
        createdAt: new Date(Date.now() - 65_000).toISOString(),
      },
      toolCalls: [
        {
          id: 'tc-011',
          runId: 'run-001',
          turnNumber: 8,
          toolName: 'propose_determination',
          input: {
            caseNumber: 'ARF-2026-001',
            criteriaResults: ['all 5 criteria MET'],
            policyBasis: ['NCD 240.0'],
          },
          output: {
            decision: 'AUTO_APPROVE',
            confidence: 0.95,
            rationale: 'All admission criteria met with strong structured evidence.',
          },
          latencyMs: 45,
          createdAt: new Date(Date.now() - 64_000).toISOString(),
        },
      ],
    },
    {
      turn: {
        id: 't-010',
        runId: 'run-001',
        turnNumber: 9,
        role: 'assistant',
        content:
          '## Review Summary — Case ARF-2026-001\n\n' +
          '**Patient:** John Doe, 68M (MBR-88901)\n' +
          '**Service:** Inpatient Admission — City General Hospital\n' +
          '**Primary Dx:** Acute respiratory failure (J96.00)\n\n' +
          '### Determination: AUTO_APPROVE (Confidence: 95%)\n\n' +
          'All 5 admission criteria for NCD 240.0 are **MET**:\n' +
          '1. Acute respiratory failure diagnosis confirmed (J96.00)\n' +
          '2. SpO2 87% — below 90% threshold (recorded 2h ago)\n' +
          '3. PaO2 55 mmHg — below 60 mmHg threshold\n' +
          '4. Mechanical ventilation in place\n' +
          '5. ICU-level care required\n\n' +
          'Evidence is primarily from structured clinical data with NLP confirmation from discharge summary. ' +
          'Coverage is active Medicare Part A. Recommend auto-approval.',
        stopReason: 'end_turn',
        inputTokens: 7500,
        outputTokens: 320,
        latencyMs: 2200,
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      },
      toolCalls: [],
    },
  ],
};

// ─── Mock Review Detail ───────────────────────────────────────────────────────

export const MOCK_REVIEW_DETAIL: ReviewDetail = {
  ...MOCK_REVIEWS[0]!,
  status: 'in_review',
  latestRunId: 'run-001',
  latestRun: MOCK_AGENT_RUN,
};

// ─── Mock Policies ────────────────────────────────────────────────────────────

export const MOCK_POLICIES: Policy[] = [
  {
    id: 'pol-001',
    policyType: 'NCD',
    cmsId: '240.0',
    title: 'Acute Respiratory Failure — Inpatient Admission Criteria',
    status: 'active',
    effectiveDate: '2025-01-01',
  },
  {
    id: 'pol-002',
    policyType: 'LCD',
    cmsId: 'L38901',
    title: 'Community-Acquired Pneumonia — Inpatient Admission',
    status: 'active',
    effectiveDate: '2024-07-01',
  },
  {
    id: 'pol-003',
    policyType: 'Internal',
    title: 'Heart Failure Exacerbation — Inpatient Criteria',
    status: 'draft',
    effectiveDate: '2025-06-01',
  },
  {
    id: 'pol-004',
    policyType: 'NCD',
    cmsId: '220.6',
    title: 'Percutaneous Transluminal Angioplasty (PTA)',
    status: 'active',
    effectiveDate: '2024-01-01',
  },
];
