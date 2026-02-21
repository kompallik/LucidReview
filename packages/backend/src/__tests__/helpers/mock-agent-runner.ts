import { randomUUID } from 'crypto';
import type { Knex } from 'knex';
import type { DeterminationResult, AgentRunStatus } from '@lucidreview/shared';

/**
 * A preset AUTO_APPROVE determination for use in tests.
 */
export const MOCK_DETERMINATION: DeterminationResult = {
  determination: 'AUTO_APPROVE',
  confidence: 0.95,
  policyBasis: [
    {
      policyType: 'LCD',
      policyId: 'L35056',
      policyTitle: 'Acute Respiratory Failure Inpatient Admission',
      policyVersion: '1.0',
    },
  ],
  criteriaResults: [
    {
      criterionId: 'arf-dx-present',
      description: 'Has Acute Respiratory Failure Diagnosis (ICD-10 J96.0x)',
      status: 'MET',
      evidence: [
        {
          fhirRef: 'Condition/test-arf-001',
          path: 'Condition.code.coding[0].code',
          valueSeen: 'J96.00',
          assertion: 'AFFIRMED',
          extractedBy: 'STRUCTURED',
        },
      ],
      evaluatedBy: 'CQL',
      confidence: 1.0,
    },
    {
      criterionId: 'recent-spo2-below-90',
      description: 'SpO2 < 90% within last 6 hours',
      status: 'MET',
      evidence: [
        {
          fhirRef: 'Observation/test-spo2-001',
          path: 'Observation.valueQuantity.value',
          valueSeen: 87,
          effectiveTime: new Date().toISOString(),
          assertion: 'AFFIRMED',
          extractedBy: 'STRUCTURED',
        },
      ],
      evaluatedBy: 'CQL',
      confidence: 1.0,
    },
    {
      criterionId: 'admission-criteria-met',
      description: 'Overall Admission Criteria Met',
      status: 'MET',
      evidence: [],
      evaluatedBy: 'CQL',
      confidence: 1.0,
    },
  ],
  rationaleNarrative:
    'Patient presents with acute respiratory failure (J96.00) and recent SpO2 of 87%. ' +
    'All inpatient admission criteria are met per LCD L35056.',
  audit: {
    cqlLibraryVersion: '1.0.0',
    artifactBundleId: 'test-bundle-v1',
  },
};

export interface MockAgentRunnerOptions {
  determination?: DeterminationResult;
  status?: AgentRunStatus;
  totalTurns?: number;
  modelId?: string;
}

/**
 * MockAgentRunner replaces the real AgentRunner for testing.
 * Returns a preset DeterminationResult without calling Bedrock/MCP.
 */
export class MockAgentRunner {
  private determination: DeterminationResult;
  private status: AgentRunStatus;
  private totalTurns: number;
  private modelId: string;

  constructor(options: MockAgentRunnerOptions = {}) {
    this.determination = options.determination ?? MOCK_DETERMINATION;
    this.status = options.status ?? 'completed';
    this.totalTurns = options.totalTurns ?? 7;
    this.modelId = options.modelId ?? 'us.anthropic.claude-sonnet-4-6';
  }

  async runReview(caseNumber: string): Promise<{
    runId: string;
    status: AgentRunStatus;
    determination: DeterminationResult;
  }> {
    return {
      runId: randomUUID(),
      status: this.status,
      determination: this.determination,
    };
  }
}

/**
 * Insert a completed agent_run row into the test database.
 * Returns the generated run ID.
 */
export async function createMockRunId(
  db: Knex,
  caseNumber: string = 'ARF-2026-001',
  options: MockAgentRunnerOptions = {}
): Promise<string> {
  const runId = randomUUID();
  const determination = options.determination ?? MOCK_DETERMINATION;
  const status = options.status ?? 'completed';

  await db('agent_runs').insert({
    id: runId,
    case_number: caseNumber,
    status,
    model_id: options.modelId ?? 'us.anthropic.claude-sonnet-4-6',
    prompt_version: 'v1.0-test',
    total_turns: options.totalTurns ?? 7,
    determination: JSON.stringify(determination),
    input_tokens_total: 12500,
    output_tokens_total: 3200,
    started_at: new Date(),
    completed_at: status === 'completed' ? new Date() : null,
  });

  return runId;
}
