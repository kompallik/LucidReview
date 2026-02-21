/**
 * Integration tests for review routes.
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

async function seedReview(
  caseNumber: string,
  overrides: Record<string, unknown> = {},
) {
  const id = randomUUID();
  await db('reviews').insert({
    id,
    case_number: caseNumber,
    status: 'pending',
    urgency: 'URGENT',
    service_type: 'Inpatient Admission',
    primary_diagnosis_code: 'J96.00',
    primary_diagnosis_display: 'Acute respiratory failure',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
  return id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/reviews', () => {
  it('returns 200 with an array of reviews', async () => {
    await seedReview('ARF-2026-001');
    await seedReview('ARF-2026-002');

    const res = await app.inject({
      method: 'GET',
      url: '/api/reviews',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by status=pending', async () => {
    await seedReview('ARF-2026-001', { status: 'pending' });
    await seedReview('ARF-2026-002', { status: 'decided' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/reviews?status=pending',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    // Should only include the pending review
    for (const review of body) {
      expect(review.status).toBe('pending');
    }
  });
});

describe('GET /api/reviews/:caseNumber', () => {
  it('returns 200 with case data for existing review', async () => {
    await seedReview('ARF-2026-001');

    const res = await app.inject({
      method: 'GET',
      url: '/api/reviews/ARF-2026-001',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.case_number ?? body.caseNumber).toBe('ARF-2026-001');
  });

  it('returns 404 for unknown case number', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reviews/UNKNOWN-999',
      headers,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/reviews/:caseNumber/agent-run', () => {
  it('returns 201 with a runId', async () => {
    // Ensure review exists
    await seedReview('ARF-2026-001');

    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews/ARF-2026-001/agent-run',
      headers,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.runId).toBeTruthy();
    expect(typeof body.runId).toBe('string');
  });
});

describe('POST /api/reviews/:caseNumber/determination', () => {
  it('returns 201 and updates review status', async () => {
    const reviewId = await seedReview('ARF-2026-001', { status: 'in_review' });
    // Create a mock agent run linked to the review
    const runId = await createMockRunId(db, 'ARF-2026-001');
    await db('reviews').where({ id: reviewId }).update({ latest_run_id: runId });

    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews/ARF-2026-001/determination',
      headers,
      payload: {
        determination: 'AUTO_APPROVE',
        reviewerId: randomUUID(),
        notes: 'All criteria met per policy L35056',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.determination ?? body.status).toBeTruthy();

    // Verify the review was updated in the DB
    const updated = await db('reviews')
      .where({ case_number: 'ARF-2026-001' })
      .first();
    expect(updated.status).toBe('decided');
  });
});
