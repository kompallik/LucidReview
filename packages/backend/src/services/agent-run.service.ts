import { randomUUID } from 'crypto';
import { db } from '../db/connection.js';

export interface AgentRunRow {
  id: string;
  case_number: string;
  status: string;
  model_id: string;
  prompt_version: string | null;
  total_turns: number;
  determination: string | null;
  error: string | null;
  input_tokens_total: number;
  output_tokens_total: number;
  started_at: Date;
  completed_at: Date | null;
}

export interface TraceResult {
  run: AgentRunRow;
  turns: Array<{
    turn: Record<string, unknown>;
    toolCalls: Array<Record<string, unknown>>;
  }>;
}

/** Serialize a raw DB agent_runs row to camelCase for the API response. */
function serializeRun(row: Record<string, unknown>): Record<string, unknown> {
  const d = (v: unknown) =>
    v instanceof Date ? v.toISOString() : (v ?? null);
  return {
    id: row['id'],
    caseNumber: row['case_number'],
    status: row['status'],
    modelId: row['model_id'],
    promptVersion: row['prompt_version'] ?? null,
    totalTurns: row['total_turns'] ?? 0,
    determination: row['determination'] ?? null,
    error: row['error'] ?? null,
    inputTokensTotal: Number(row['input_tokens_total'] ?? 0),
    outputTokensTotal: Number(row['output_tokens_total'] ?? 0),
    startedAt: d(row['started_at']),
    completedAt: d(row['completed_at']),
  };
}

/** Serialize a raw DB agent_turns row to camelCase. */
function serializeTurn(row: Record<string, unknown>): Record<string, unknown> {
  const d = (v: unknown) =>
    v instanceof Date ? v.toISOString() : (v ?? null);
  return {
    id: row['id'],
    runId: row['run_id'],
    turnNumber: row['turn_number'],
    role: row['role'],
    content: row['content'],
    stopReason: row['stop_reason'] ?? null,
    inputTokens: Number(row['input_tokens'] ?? 0),
    outputTokens: Number(row['output_tokens'] ?? 0),
    latencyMs: row['latency_ms'] ?? null,
    createdAt: d(row['created_at']),
  };
}

/** Serialize a raw DB agent_tool_calls row to camelCase. */
function serializeToolCall(row: Record<string, unknown>): Record<string, unknown> {
  const d = (v: unknown) =>
    v instanceof Date ? v.toISOString() : (v ?? null);
  return {
    id: row['id'],
    runId: row['run_id'],
    turnNumber: row['turn_number'],
    toolUseId: row['tool_use_id'],
    toolName: row['tool_name'],
    input: row['input'],
    output: row['output'],
    latencyMs: row['latency_ms'] ?? null,
    error: row['error'] ?? null,
    createdAt: d(row['created_at']),
  };
}

/**
 * Create a new agent run record and launch the agent asynchronously.
 */
export async function createAndRun(
  caseNumber: string
): Promise<{ runId: string; status: string }> {
  const runId = randomUUID();

  await db('agent_runs').insert({
    id: runId,
    case_number: caseNumber,
    status: 'pending',
    model_id: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6',
    started_at: new Date(),
  });

  // Update the reviews table with the latest run reference
  await db('reviews').where({ case_number: caseNumber }).update({
    latest_run_id: runId,
    status: 'in_review',
    updated_at: new Date(),
  });

  // Queue the agent run via Redis (BullMQ)
  import('../queue/agent-queue.js')
    .then(({ addAgentJob }) => addAgentJob(runId, caseNumber))
    .catch(async (err) => {
      console.error(`Failed to queue agent run ${runId}:`, err);
      await db('agent_runs')
        .where({ id: runId })
        .update({ status: 'failed', error: String(err) });
    });

  return { runId, status: 'pending' };
}

/**
 * Get an agent run by ID.
 */
export async function getRun(runId: string): Promise<AgentRunRow | null> {
  const row = await db('agent_runs').where({ id: runId }).first();
  return row ? (serializeRun(row) as unknown as AgentRunRow) : null;
}

/**
 * Get the full trace for an agent run: turns with grouped tool calls.
 */
export async function getTrace(runId: string): Promise<TraceResult> {
  const run = await db('agent_runs').where({ id: runId }).first();

  const turns = await db('agent_turns')
    .where({ run_id: runId })
    .orderBy('turn_number', 'asc');

  const toolCalls = await db('agent_tool_calls')
    .where({ run_id: runId })
    .orderBy('turn_number', 'asc');

  // Group tool calls by turn_number
  const toolCallsByTurn = new Map<number, Array<Record<string, unknown>>>();
  for (const tc of toolCalls) {
    const turnNum = tc.turn_number as number;
    if (!toolCallsByTurn.has(turnNum)) {
      toolCallsByTurn.set(turnNum, []);
    }
    toolCallsByTurn.get(turnNum)!.push(tc);
  }

  const traceTurns = turns.map((turn: Record<string, unknown>) => ({
    turn: serializeTurn(turn),
    toolCalls: (toolCallsByTurn.get(turn['turn_number'] as number) ?? []).map(serializeToolCall),
  }));

  return { run: serializeRun(run) as unknown as AgentRunRow, turns: traceTurns };
}

/**
 * Cancel a running agent run. Only cancels if currently in 'running' or 'pending' status.
 */
export async function cancelRun(runId: string): Promise<{ success: boolean }> {
  const run = await db('agent_runs').where({ id: runId }).first();

  if (!run || (run.status !== 'running' && run.status !== 'pending')) {
    return { success: false };
  }

  await db('agent_runs')
    .where({ id: runId })
    .update({ status: 'cancelled', completed_at: new Date() });

  // Also remove from BullMQ queue if not yet picked up
  const { removeAgentJob } = await import('../queue/agent-queue.js');
  await removeAgentJob(runId).catch(() => {}); // best-effort

  return { success: true };
}
