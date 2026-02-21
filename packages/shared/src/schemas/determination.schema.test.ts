import { describe, it, expect } from 'vitest';
import { DeterminationResultSchema, CriteriaResultSchema, EvidenceItemSchema } from './determination.schema.js';

const validDetermination = {
  determination: 'AUTO_APPROVE' as const,
  confidence: 0.95,
  policyBasis: [
    {
      policyType: 'LCD' as const,
      policyId: 'L35056',
      policyTitle: 'Acute Respiratory Failure Inpatient Admission',
    },
  ],
  criteriaResults: [
    {
      criterionId: 'arf-dx-present',
      description: 'Has Acute Respiratory Failure Diagnosis',
      status: 'MET' as const,
      evidence: [
        {
          fhirRef: 'Condition/arf-001',
          path: 'Condition.code.coding[0].code',
          valueSeen: 'J96.00',
          assertion: 'AFFIRMED' as const,
          extractedBy: 'STRUCTURED' as const,
        },
      ],
      evaluatedBy: 'CQL' as const,
      confidence: 1.0,
    },
  ],
  audit: {
    cqlLibraryVersion: '1.0.0',
    artifactBundleId: 'bundle-arf-v1',
  },
};

describe('DeterminationResultSchema', () => {
  it('validates a correct AUTO_APPROVE result', () => {
    const result = DeterminationResultSchema.safeParse(validDetermination);
    expect(result.success).toBe(true);
  });

  it('validates MD_REVIEW with escalation rationale', () => {
    const mdReview = {
      ...validDetermination,
      determination: 'MD_REVIEW',
      confidence: 0.6,
      criteriaResults: [
        {
          ...validDetermination.criteriaResults[0],
          status: 'UNKNOWN',
        },
      ],
      denialOrEscalationRationale: {
        summary: 'Missing SpO2 data for last 6 hours',
        missingInfoRequests: [
          {
            questionId: 'q-spo2',
            question: 'What is the most recent SpO2 reading?',
            dataElement: 'Observation.SpO2',
            reason: 'No pulse oximetry data found in structured or unstructured records',
          },
        ],
      },
    };
    const result = DeterminationResultSchema.safeParse(mdReview);
    expect(result.success).toBe(true);
  });

  it('validates with LLM audit info', () => {
    const withLlm = {
      ...validDetermination,
      audit: {
        ...validDetermination.audit,
        llm: {
          model: 'anthropic.claude-sonnet-4-20250514',
          promptVersion: 'v1.0',
          inputHash: 'abc123',
          outputHash: 'def456',
        },
      },
    };
    const result = DeterminationResultSchema.safeParse(withLlm);
    expect(result.success).toBe(true);
  });

  it('rejects missing determination field', () => {
    const { determination: _, ...missing } = validDetermination;
    const result = DeterminationResultSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('rejects missing confidence field', () => {
    const { confidence: _, ...missing } = validDetermination;
    const result = DeterminationResultSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('rejects missing audit field', () => {
    const { audit: _, ...missing } = validDetermination;
    const result = DeterminationResultSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('rejects missing policyBasis field', () => {
    const { policyBasis: _, ...missing } = validDetermination;
    const result = DeterminationResultSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('rejects invalid determination value', () => {
    const invalid = { ...validDetermination, determination: 'REJECT' };
    const result = DeterminationResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects confidence > 1', () => {
    const invalid = { ...validDetermination, confidence: 1.5 };
    const result = DeterminationResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects confidence < 0', () => {
    const invalid = { ...validDetermination, confidence: -0.1 };
    const result = DeterminationResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('CriteriaResultSchema', () => {
  it('validates a MET criterion with evidence', () => {
    const result = CriteriaResultSchema.safeParse(validDetermination.criteriaResults[0]);
    expect(result.success).toBe(true);
  });

  it('rejects invalid status value', () => {
    const invalid = { ...validDetermination.criteriaResults[0], status: 'PARTIAL' };
    const result = CriteriaResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid evaluatedBy value', () => {
    const invalid = { ...validDetermination.criteriaResults[0], evaluatedBy: 'AI' };
    const result = CriteriaResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('EvidenceItemSchema', () => {
  it('validates a minimal evidence item', () => {
    const result = EvidenceItemSchema.safeParse({
      fhirRef: 'Observation/spo2-001',
      path: 'Observation.valueQuantity.value',
      valueSeen: 87,
    });
    expect(result.success).toBe(true);
  });

  it('validates evidence with sourceDoc', () => {
    const result = EvidenceItemSchema.safeParse({
      fhirRef: 'Condition/arf-001',
      path: 'Condition.code',
      valueSeen: 'J96.00',
      sourceDoc: {
        documentReference: 'DocumentReference/doc-001',
        offsetStart: 120,
        offsetEnd: 145,
        excerpt: 'acute respiratory failure',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts boolean valueSeen', () => {
    const result = EvidenceItemSchema.safeParse({
      fhirRef: 'Observation/intubated',
      path: 'Observation.valueBoolean',
      valueSeen: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing fhirRef', () => {
    const result = EvidenceItemSchema.safeParse({
      path: 'Observation.valueQuantity.value',
      valueSeen: 87,
    });
    expect(result.success).toBe(false);
  });
});
