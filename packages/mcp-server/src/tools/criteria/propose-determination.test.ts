import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProposeDetermination } from './propose-determination.js';

// Capture the tool handler so we can call it directly in tests
let toolHandler: (args: {
  caseNumber: string;
  criteriaResults: Array<{ name: string; result: 'MET' | 'NOT_MET' | 'UNKNOWN'; value?: unknown; evidence?: string }>;
  policyBasis: Array<{ policyId: string | number; title: string; cmsId?: string }>;
}) => Promise<{ content: Array<{ type: string; text: string }> }>;

function parseDetermination(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0].text);
}

const POLICY_BASIS = [{ policyId: 'POL-001', title: 'Acute Respiratory Failure' }];

describe('propose_determination tool', () => {
  beforeEach(() => {
    const server = new McpServer({ name: 'test', version: '1.0.0' });

    // Intercept the tool registration to capture the handler
    const origTool = server.tool.bind(server) as (...args: unknown[]) => unknown;
    vi.spyOn(server, 'tool').mockImplementation(
      (...args: unknown[]) => {
        // The handler is the last argument
        toolHandler = args[args.length - 1] as typeof toolHandler;
        return origTool(...args) as ReturnType<typeof server.tool>;
      },
    );

    registerProposeDetermination(server);
  });

  it('returns AUTO_APPROVE when all criteria are MET', async () => {
    const result = await toolHandler({
      caseNumber: 'ARF-2026-001',
      criteriaResults: [
        { name: 'HasAcuteRespFailure', result: 'MET' },
        { name: 'RecentO2SatBelow90', result: 'MET' },
        { name: 'AdmissionCriteriaMet', result: 'MET' },
      ],
      policyBasis: POLICY_BASIS,
    });
    const det = parseDetermination(result);
    expect(det.determination).toBe('AUTO_APPROVE');
    expect(det.confidence).toBeGreaterThanOrEqual(0.9);
    expect(det.criteriasSummary.met).toBe(3);
    expect(det.criteriasSummary.total).toBe(3);
  });

  it('returns MORE_INFO when any criteria is UNKNOWN (no NOT_MET)', async () => {
    const result = await toolHandler({
      caseNumber: 'ARF-2026-001',
      criteriaResults: [
        { name: 'HasAcuteRespFailure', result: 'MET' },
        { name: 'RecentO2SatBelow90', result: 'UNKNOWN' },
        { name: 'AdmissionCriteriaMet', result: 'MET' },
      ],
      policyBasis: POLICY_BASIS,
    });
    const det = parseDetermination(result);
    expect(det.determination).toBe('MORE_INFO');
    expect(det.criteriasSummary.unknown).toBe(1);
  });

  it('returns MD_REVIEW when any criteria is NOT_MET', async () => {
    const result = await toolHandler({
      caseNumber: 'ARF-2026-001',
      criteriaResults: [
        { name: 'HasAcuteRespFailure', result: 'MET' },
        { name: 'RecentO2SatBelow90', result: 'NOT_MET' },
        { name: 'AdmissionCriteriaMet', result: 'MET' },
      ],
      policyBasis: POLICY_BASIS,
    });
    const det = parseDetermination(result);
    expect(det.determination).toBe('MD_REVIEW');
    expect(det.criteriasSummary.notMet).toBe(1);
  });

  it('returns MD_REVIEW when UNKNOWN and NOT_MET are both present', async () => {
    const result = await toolHandler({
      caseNumber: 'ARF-2026-001',
      criteriaResults: [
        { name: 'HasAcuteRespFailure', result: 'UNKNOWN' },
        { name: 'RecentO2SatBelow90', result: 'NOT_MET' },
      ],
      policyBasis: POLICY_BASIS,
    });
    const det = parseDetermination(result);
    expect(det.determination).toBe('MD_REVIEW');
  });

  it('returns MORE_INFO when all criteria are UNKNOWN', async () => {
    const result = await toolHandler({
      caseNumber: 'ARF-2026-001',
      criteriaResults: [
        { name: 'HasAcuteRespFailure', result: 'UNKNOWN' },
        { name: 'RecentO2SatBelow90', result: 'UNKNOWN' },
      ],
      policyBasis: POLICY_BASIS,
    });
    const det = parseDetermination(result);
    expect(det.determination).toBe('MORE_INFO');
    expect(det.criteriasSummary.unknown).toBe(2);
    expect(det.criteriasSummary.met).toBe(0);
  });

  it('returns MD_REVIEW when all criteria are NOT_MET (conservative, no DENY)', async () => {
    const result = await toolHandler({
      caseNumber: 'ARF-2026-001',
      criteriaResults: [
        { name: 'HasAcuteRespFailure', result: 'NOT_MET' },
        { name: 'RecentO2SatBelow90', result: 'NOT_MET' },
        { name: 'AdmissionCriteriaMet', result: 'NOT_MET' },
      ],
      policyBasis: POLICY_BASIS,
    });
    const det = parseDetermination(result);
    // Conservative: never auto-deny, always send to MD
    expect(det.determination).toBe('MD_REVIEW');
    expect(det.determination).not.toBe('DENY');
  });

  it('returns MD_REVIEW when no criteria provided (empty array)', async () => {
    const result = await toolHandler({
      caseNumber: 'ARF-2026-001',
      criteriaResults: [],
      policyBasis: POLICY_BASIS,
    });
    const det = parseDetermination(result);
    expect(det.determination).toBe('MD_REVIEW');
    expect(det.confidence).toBe(0);
  });

  it('includes caseNumber, timestamp, and policy basis in result', async () => {
    const result = await toolHandler({
      caseNumber: 'ARF-2026-001',
      criteriaResults: [{ name: 'Test', result: 'MET' }],
      policyBasis: POLICY_BASIS,
    });
    const det = parseDetermination(result);
    expect(det.caseNumber).toBe('ARF-2026-001');
    expect(det.timestamp).toBeTruthy();
    expect(det.policyBasis).toEqual(POLICY_BASIS);
    expect(det.note).toContain('human reviewer');
  });

  it('returns confidence between 0 and 1', async () => {
    for (const results of [
      [{ name: 'A', result: 'MET' as const }],
      [{ name: 'A', result: 'NOT_MET' as const }],
      [{ name: 'A', result: 'UNKNOWN' as const }],
      [
        { name: 'A', result: 'MET' as const },
        { name: 'B', result: 'NOT_MET' as const },
      ],
    ]) {
      const res = await toolHandler({
        caseNumber: 'TEST',
        criteriaResults: results,
        policyBasis: POLICY_BASIS,
      });
      const det = parseDetermination(res);
      expect(det.confidence).toBeGreaterThanOrEqual(0);
      expect(det.confidence).toBeLessThanOrEqual(1);
    }
  });
});
