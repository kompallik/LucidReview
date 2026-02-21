/**
 * Integration tests for agent-run routes.
 *
 * These tests use Fastify's inject() and a real test DB.
 * The backend app must be built (src/app.ts) for these to pass.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/test-app.js';
import {
  getTestDb,
  truncateAllTables,
  destroyTestDb,
} from '../helpers/test-db.js';
import { createMockRunId, MOCK_DETERMINATION } from '../helpers/mock-agent-runner.js';
import { authHeaders } from '../helpers/test-auth.js';

let app: FastifyInstance;
let headers: Record<string, string>;
const db = getTestDb();

beforeAll(async () => {
  app = await buildTestApp();
  headers = authHeaders(app);
});

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await app?.close();
  await destroyTestDb();
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedTurn(
  runId: string,
  turnNumber: number,
  overrides: Record<string, unknown> = {},
) {
  const id = randomUUID();
  await db('agent_turns').insert({
    id,
    run_id: runId,
    turn_number: turnNumber,
    role: 'assistant',
    content: JSON.stringify([{ text: `Turn ${turnNumber} response` }]),
    stop_reason: 'end_turn',
    input_tokens: 1000,
    output_tokens: 300,
    latency_ms: 450,
    created_at: new Date(),
    ...overrides,
  });
  return id;
}

async function seedToolCall(
  runId: string,
  turnNumber: number,
  toolName: string,
  overrides: Record<string, unknown> = {},
) {
  const id = randomUUID();
  await db('agent_tool_calls').insert({
    id,
    run_id: runId,
    turn_number: turnNumber,
    tool_use_id: `tu-${randomUUID()}`,
    tool_name: toolName,
    input: JSON.stringify({ caseNumber: 'ARF-2026-001' }),
    output: JSON.stringify({ patient: { firstName: 'John' } }),
    latency_ms: 120,
    created_at: new Date(),
    ...overrides,
  });
  return id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/agent-runs/:runId', () => {
  it('returns 200 with run data for existing run', async () => {
    const runId = await createMockRunId(db, 'ARF-2026-001');

    const res = await app.inject({
      method: 'GET',
      url: `/api/agent-runs/${runId}`,
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id ?? body.runId).toBe(runId);
    expect(body.status).toBe('completed');
    expect(body.case_number ?? body.caseNumber).toBe('ARF-2026-001');
  });

  it('returns 404 for unknown runId', async () => {
    const fakeId = randomUUID();
    const res = await app.inject({
      method: 'GET',
      url: `/api/agent-runs/${fakeId}`,
      headers,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/agent-runs/:runId/trace', () => {
  it('returns 200 with turns and tool calls', async () => {
    const runId = await createMockRunId(db, 'ARF-2026-001');

    // Seed 2 turns with tool calls
    await seedTurn(runId, 1, { stop_reason: 'tool_use' });
    await seedToolCall(runId, 1, 'um_get_case');
    await seedToolCall(runId, 1, 'um_get_clinical_info');
    await seedTurn(runId, 2, { stop_reason: 'end_turn' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/agent-runs/${runId}/trace`,
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Should contain turn data
    const turns = body.turns ?? body;
    expect(Array.isArray(turns)).toBe(true);
    expect(turns.length).toBeGreaterThanOrEqual(2);

    // First turn should have tool calls
    const firstTurn = turns[0];
    const toolCalls = firstTurn.toolCalls ?? firstTurn.tool_calls ?? [];
    expect(toolCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /api/agent-runs/:runId', () => {
  it('returns 200 and cancels a running agent', async () => {
    // Create a "running" agent run
    const runId = await createMockRunId(db, 'ARF-2026-001', {
      status: 'running',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/agent-runs/${runId}`,
      headers,
    });

    expect(res.statusCode).toBe(200);

    // Verify run is cancelled in DB
    const run = await db('agent_runs').where({ id: runId }).first();
    expect(run.status).toBe('cancelled');
  });
});
