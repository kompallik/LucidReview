import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for agent-run.service.ts.
 *
 * Expected service interface:
 *   createAndRun(caseNumber, options?): Promise<{ runId: string; status: string }>
 *   getRun(runId): Promise<AgentRun | null>
 *   getTrace(runId): Promise<AgentRunTrace>
 *   cancelRun(runId): Promise<{ success: boolean }>
 */

// Mock the db module before importing the service
vi.mock('../../db/connection.js', () => {
  const mockKnex = vi.fn();
  return { db: mockKnex };
});

// Mock the queue module (used by cancelRun for removeAgentJob)
vi.mock('../../queue/agent-queue.js', () => ({
  removeAgentJob: vi.fn().mockResolvedValue(true),
  addAgentJob: vi.fn().mockResolvedValue(undefined),
}));

// Mock the agent runner
vi.mock('../../agent/agent-runner.js', () => ({
  AgentRunner: vi.fn().mockImplementation(() => ({
    runReview: vi.fn().mockResolvedValue({
      runId: 'mock-run-id',
      status: 'completed',
    }),
  })),
}));

import { db } from '../../db/connection.js';
import {
  createAndRun,
  getRun,
  getTrace,
  cancelRun,
} from '../../services/agent-run.service.js';

const mockDb = db as unknown as ReturnType<typeof vi.fn>;

describe('agent-run.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAndRun', () => {
    it('inserts an agent_run row with status="pending" and returns a UUID', async () => {
      const mockInsert = vi.fn().mockResolvedValue([1]);
      const mockUpdate = vi.fn().mockResolvedValue(1);
      const mockUpdateWhere = vi.fn().mockReturnValue({ update: mockUpdate });

      mockDb.mockImplementation((table: string) => {
        if (table === 'agent_runs') return { insert: mockInsert };
        if (table === 'reviews') return { where: mockUpdateWhere };
        return {};
      });

      const result = await createAndRun('ARF-2026-001');

      expect(result).toHaveProperty('runId');
      expect(result.runId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(result).toHaveProperty('status', 'pending');

      // Verify the insert was called with correct table
      expect(mockDb).toHaveBeenCalledWith('agent_runs');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          case_number: 'ARF-2026-001',
          status: 'pending',
        })
      );

      // Verify latest_run_id update on reviews table
      expect(mockDb).toHaveBeenCalledWith('reviews');
      expect(mockUpdateWhere).toHaveBeenCalledWith(
        expect.objectContaining({ case_number: 'ARF-2026-001' })
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          latest_run_id: result.runId,
          status: 'in_review',
        })
      );
    });
  });

  describe('getRun', () => {
    it('returns the agent run row by id', async () => {
      const mockRow = {
        id: 'run-123',
        case_number: 'ARF-2026-001',
        status: 'completed',
        model_id: 'us.anthropic.claude-sonnet-4-6',
        determination: JSON.stringify({ determination: 'AUTO_APPROVE' }),
        started_at: new Date(),
        completed_at: new Date(),
      };

      const mockFirst = vi.fn().mockResolvedValue(mockRow);
      const mockWhere = vi.fn().mockReturnValue({ first: mockFirst });
      mockDb.mockReturnValue({ where: mockWhere });

      const result = await getRun('run-123');

      expect(mockDb).toHaveBeenCalledWith('agent_runs');
      expect(mockWhere).toHaveBeenCalledWith({ id: 'run-123' });
      expect(result).toEqual(mockRow);
    });

    it('returns null when run not found', async () => {
      const mockFirst = vi.fn().mockResolvedValue(undefined);
      const mockWhere = vi.fn().mockReturnValue({ first: mockFirst });
      mockDb.mockReturnValue({ where: mockWhere });

      const result = await getRun('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getTrace', () => {
    it('returns turns array with tool calls grouped by turn_number', async () => {
      const mockTurns = [
        { id: 't1', run_id: 'run-123', turn_number: 1, role: 'user', content: '{}' },
        { id: 't2', run_id: 'run-123', turn_number: 2, role: 'assistant', content: '{}' },
      ];
      const mockToolCalls = [
        {
          id: 'tc1',
          run_id: 'run-123',
          turn_number: 2,
          tool_use_id: 'tu-1',
          tool_name: 'um_get_case',
          input: '{}',
          output: '{}',
        },
        {
          id: 'tc2',
          run_id: 'run-123',
          turn_number: 2,
          tool_use_id: 'tu-2',
          tool_name: 'um_get_clinical_info',
          input: '{}',
          output: '{}',
        },
      ];

      // Mock for agent_runs select
      const mockRunFirst = vi.fn().mockResolvedValue({
        id: 'run-123',
        case_number: 'ARF-2026-001',
        status: 'completed',
      });
      const mockRunWhere = vi.fn().mockReturnValue({ first: mockRunFirst });

      // Mock for agent_turns select
      const mockTurnsOrderBy = vi.fn().mockResolvedValue(mockTurns);
      const mockTurnsWhere = vi.fn().mockReturnValue({ orderBy: mockTurnsOrderBy });

      // Mock for agent_tool_calls select
      const mockToolsOrderBy = vi.fn().mockResolvedValue(mockToolCalls);
      const mockToolsWhere = vi.fn().mockReturnValue({ orderBy: mockToolsOrderBy });

      let callCount = 0;
      mockDb.mockImplementation((table: string) => {
        if (table === 'agent_runs') return { where: mockRunWhere };
        if (table === 'agent_turns') return { where: mockTurnsWhere };
        if (table === 'agent_tool_calls') return { where: mockToolsWhere };
        return {};
      });

      const result = await getTrace('run-123');

      expect(result).toHaveProperty('run');
      expect(result).toHaveProperty('turns');
      expect(result.turns).toHaveLength(2);
      // Turn 2 should have the two tool calls grouped
      const turn2 = result.turns.find((t) => t.turn.turn_number === 2);
      expect(turn2?.toolCalls).toHaveLength(2);
    });
  });

  describe('cancelRun', () => {
    it('updates status to cancelled when currently running', async () => {
      const mockFirst = vi.fn().mockResolvedValue({
        id: 'run-123',
        status: 'running',
      });
      const mockSelectWhere = vi.fn().mockReturnValue({ first: mockFirst });

      const mockUpdate = vi.fn().mockResolvedValue(1);
      const mockUpdateWhere = vi.fn().mockReturnValue({ update: mockUpdate });

      let callCount = 0;
      mockDb.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { where: mockSelectWhere };
        return { where: mockUpdateWhere };
      });

      const result = await cancelRun('run-123');

      expect(result).toEqual({ success: true });
    });

    it('does not cancel a run that is already completed', async () => {
      const mockFirst = vi.fn().mockResolvedValue({
        id: 'run-123',
        status: 'completed',
      });
      const mockWhere = vi.fn().mockReturnValue({ first: mockFirst });
      mockDb.mockReturnValue({ where: mockWhere });

      const result = await cancelRun('run-123');

      expect(result).toEqual({ success: false });
    });
  });
});
