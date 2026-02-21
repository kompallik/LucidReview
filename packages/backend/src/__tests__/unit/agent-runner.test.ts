/**
 * Unit tests for the AgentRunner.
 *
 * These tests mock all external dependencies (Bedrock, MCP, DB) to verify
 * the orchestration logic of the agent runner in isolation.
 *
 * Expected AgentRunner interface (to be implemented in src/agent/agent-runner.ts):
 *
 *   export class AgentRunner {
 *     constructor(deps: {
 *       db: Knex;
 *       bedrockClient: BedrockRuntimeClient;
 *       mcpClient: Client;           // MCP SDK Client
 *       modelId?: string;
 *       maxTurns?: number;
 *     });
 *     async runReview(caseNumber: string): Promise<{
 *       runId: string;
 *       status: 'completed' | 'failed';
 *       determination?: unknown;
 *       error?: string;
 *     }>;
 *   }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Mock: @aws-sdk/client-bedrock-runtime
// ---------------------------------------------------------------------------
const mockBedrockSend = vi.fn();

vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
      send: mockBedrockSend,
    })),
    ConverseCommand: vi.fn().mockImplementation((input: unknown) => ({
      input,
    })),
  };
});

// ---------------------------------------------------------------------------
// Mock: MCP Client — listTools + callTool
// ---------------------------------------------------------------------------
const mockListTools = vi.fn();
const mockCallTool = vi.fn();
const mockMcpClose = vi.fn();

const mockMcpClient = {
  listTools: mockListTools,
  callTool: mockCallTool,
  close: mockMcpClose,
};

// ---------------------------------------------------------------------------
// Mock: Knex DB
// ---------------------------------------------------------------------------
function createMockDb() {
  const rows: Record<string, unknown[]> = {
    agent_runs: [],
    agent_turns: [],
    agent_tool_calls: [],
  };

  const mockTable = (tableName: string) => {
    const chain = {
      insert: vi.fn().mockImplementation(async (row: unknown) => {
        rows[tableName]?.push(row);
        return [1];
      }),
      where: vi.fn().mockReturnThis(),
      update: vi.fn().mockImplementation(async (data: unknown) => {
        // Update the last matching row (simplified mock)
        const table = rows[tableName];
        if (table && table.length > 0) {
          Object.assign(table[table.length - 1] as Record<string, unknown>, data);
        }
        return 1;
      }),
      first: vi.fn().mockImplementation(async () => {
        const table = rows[tableName];
        return table?.[table.length - 1] ?? null;
      }),
      select: vi.fn().mockReturnThis(),
    };
    return chain;
  };

  const db = vi.fn().mockImplementation((tableName: string) => mockTable(tableName)) as unknown as {
    (tableName: string): ReturnType<typeof mockTable>;
    _rows: typeof rows;
  };
  (db as Record<string, unknown>)._rows = rows;

  return db;
}

// ---------------------------------------------------------------------------
// Helpers to build Bedrock Converse API responses
// ---------------------------------------------------------------------------
function makeEndTurnResponse(text: string = 'Review complete.') {
  return {
    output: {
      message: {
        role: 'assistant',
        content: [{ text }],
      },
    },
    stopReason: 'end_turn',
    usage: { inputTokens: 1500, outputTokens: 400 },
  };
}

function makeToolUseResponse(
  toolName: string,
  toolInput: Record<string, unknown>,
  toolUseId: string = randomUUID(),
) {
  return {
    output: {
      message: {
        role: 'assistant',
        content: [
          {
            toolUse: {
              toolUseId,
              name: toolName,
              input: toolInput,
            },
          },
        ],
      },
    },
    stopReason: 'tool_use',
    usage: { inputTokens: 1200, outputTokens: 300 },
  };
}

const DUMMY_TOOLS = {
  tools: [
    {
      name: 'um_get_case',
      description: 'Fetch case summary',
      inputSchema: { type: 'object' as const, properties: { caseNumber: { type: 'string' } } },
    },
    {
      name: 'um_get_clinical_info',
      description: 'Fetch clinical info',
      inputSchema: { type: 'object' as const, properties: { caseNumber: { type: 'string' } } },
    },
    {
      name: 'propose_determination',
      description: 'Propose determination',
      inputSchema: { type: 'object' as const, properties: { caseNumber: { type: 'string' } } },
    },
  ],
};

const DUMMY_TOOL_RESULT = {
  content: [{ type: 'text', text: '{"caseNumber":"ARF-2026-001","patient":{"firstName":"John"}}' }],
};

describe('AgentRunner', () => {
  let AgentRunner: new (deps: {
    db: unknown;
    bedrockClient: unknown;
    mcpClient: unknown;
    modelId?: string;
    maxTurns?: number;
  }) => { runReview(caseNumber: string): Promise<{ runId: string; status: string; determination?: unknown; error?: string }> };

  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb = createMockDb();

    // Default mock implementations
    mockListTools.mockResolvedValue(DUMMY_TOOLS);
    mockCallTool.mockResolvedValue(DUMMY_TOOL_RESULT);

    // Dynamic import to pick up mocks
    const mod = await import('../../agent/agent-runner.js');
    AgentRunner = mod.AgentRunner;
  });

  it('completes a successful run reaching end_turn', async () => {
    // Bedrock returns end_turn immediately (no tool calls needed)
    mockBedrockSend.mockResolvedValueOnce(makeEndTurnResponse('Case review complete. All criteria met.'));

    const runner = new AgentRunner({
      db: mockDb,
      bedrockClient: { send: mockBedrockSend },
      mcpClient: mockMcpClient,
      modelId: 'us.anthropic.claude-sonnet-4-6',
    });

    const result = await runner.runReview('ARF-2026-001');

    expect(result.status).toBe('completed');
    expect(result.runId).toBeTruthy();

    // Verify agent_runs was inserted then updated to completed
    const runRows = mockDb._rows.agent_runs;
    expect(runRows.length).toBeGreaterThanOrEqual(1);
    const lastRun = runRows[runRows.length - 1] as Record<string, unknown>;
    expect(lastRun.status).toBe('completed');

    // Verify listTools was called to get tool schemas
    expect(mockListTools).toHaveBeenCalled();
  });

  it('executes tool call loop: tool_use → callTool → end_turn', async () => {
    const toolUseId = 'tu-' + randomUUID();

    // First call: Bedrock requests a tool call
    mockBedrockSend.mockResolvedValueOnce(
      makeToolUseResponse('um_get_case', { caseNumber: 'ARF-2026-001' }, toolUseId),
    );
    // Second call: Bedrock says done
    mockBedrockSend.mockResolvedValueOnce(
      makeEndTurnResponse('Review complete based on case data.'),
    );

    const runner = new AgentRunner({
      db: mockDb,
      bedrockClient: { send: mockBedrockSend },
      mcpClient: mockMcpClient,
    });

    const result = await runner.runReview('ARF-2026-001');

    expect(result.status).toBe('completed');

    // McpClient.callTool should have been called once with correct tool name
    expect(mockCallTool).toHaveBeenCalledTimes(1);
    expect(mockCallTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'um_get_case',
        arguments: { caseNumber: 'ARF-2026-001' },
      }),
    );

    // Bedrock should have been called twice (initial + after tool result)
    expect(mockBedrockSend).toHaveBeenCalledTimes(2);

    // agent_tool_calls row should have been inserted
    const toolCallRows = mockDb._rows.agent_tool_calls;
    expect(toolCallRows.length).toBeGreaterThanOrEqual(1);
    const toolCall = toolCallRows[0] as Record<string, unknown>;
    expect(toolCall.tool_name).toBe('um_get_case');
  });

  it('sets run to failed when Bedrock throws an error', async () => {
    mockBedrockSend.mockRejectedValueOnce(new Error('Bedrock throttling: rate limit exceeded'));

    const runner = new AgentRunner({
      db: mockDb,
      bedrockClient: { send: mockBedrockSend },
      mcpClient: mockMcpClient,
    });

    const result = await runner.runReview('ARF-2026-001');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('rate limit');

    // agent_runs should be updated to failed with error message
    const runRows = mockDb._rows.agent_runs;
    expect(runRows.length).toBeGreaterThanOrEqual(1);
    const lastRun = runRows[runRows.length - 1] as Record<string, unknown>;
    expect(lastRun.status).toBe('failed');
    expect(lastRun.error).toBeTruthy();
  });

  it('exits after MAX_TURNS when Bedrock always returns tool_use', async () => {
    const MAX_TURNS = 25;

    // Bedrock always returns tool_use — never stops
    mockBedrockSend.mockImplementation(async () =>
      makeToolUseResponse('um_get_case', { caseNumber: 'ARF-2026-001' }),
    );

    const runner = new AgentRunner({
      db: mockDb,
      bedrockClient: { send: mockBedrockSend },
      mcpClient: mockMcpClient,
      maxTurns: MAX_TURNS,
    });

    const result = await runner.runReview('ARF-2026-001');

    // Should complete (not hang forever) after hitting max turns
    expect(result.status).toBe('completed');

    // Bedrock should have been called exactly MAX_TURNS times
    expect(mockBedrockSend).toHaveBeenCalledTimes(MAX_TURNS);

    // agent_runs should show completed status
    const runRows = mockDb._rows.agent_runs;
    const lastRun = runRows[runRows.length - 1] as Record<string, unknown>;
    expect(lastRun.status).toBe('completed');
  });

  it('persists agent_turns for each Bedrock response', async () => {
    // tool_use then end_turn = 2 turns
    mockBedrockSend.mockResolvedValueOnce(
      makeToolUseResponse('um_get_clinical_info', { caseNumber: 'ARF-2026-001' }),
    );
    mockBedrockSend.mockResolvedValueOnce(makeEndTurnResponse('Done.'));

    const runner = new AgentRunner({
      db: mockDb,
      bedrockClient: { send: mockBedrockSend },
      mcpClient: mockMcpClient,
    });

    await runner.runReview('ARF-2026-001');

    // Should have at least 2 turn rows (one for each Bedrock response)
    const turnRows = mockDb._rows.agent_turns;
    expect(turnRows.length).toBeGreaterThanOrEqual(2);
  });

  it('includes tool schemas from listTools in Bedrock toolConfig', async () => {
    mockBedrockSend.mockResolvedValueOnce(makeEndTurnResponse('Complete.'));

    const runner = new AgentRunner({
      db: mockDb,
      bedrockClient: { send: mockBedrockSend },
      mcpClient: mockMcpClient,
    });

    await runner.runReview('ARF-2026-001');

    // Verify Bedrock was called with tool configuration
    expect(mockBedrockSend).toHaveBeenCalledTimes(1);
    const sentCommand = mockBedrockSend.mock.calls[0][0];
    const input = sentCommand.input ?? sentCommand;

    // Should include toolConfig with the 3 dummy tools
    expect(input.toolConfig).toBeDefined();
    expect(input.toolConfig.tools).toHaveLength(3);
    const toolNames = input.toolConfig.tools.map(
      (t: { toolSpec: { name: string } }) => t.toolSpec.name,
    );
    expect(toolNames).toContain('um_get_case');
    expect(toolNames).toContain('propose_determination');
  });
});
