/**
 * Integration tests for policy routes.
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

async function seedPolicy(
  title: string,
  overrides: Record<string, unknown> = {},
) {
  const id = randomUUID();
  await db('policies').insert({
    id,
    policy_type: 'LCD',
    cms_id: `L${Math.floor(10000 + Math.random() * 89999)}`,
    title,
    status: 'ACTIVE',
    sections_json: JSON.stringify({
      diagnosisCodes: ['J96.00', 'J96.01'],
      serviceTypes: ['Inpatient Admission'],
    }),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
  return id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/policies', () => {
  it('returns 200 with an empty array when no policies exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/policies',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('returns 200 with seeded policies', async () => {
    await seedPolicy('Acute Respiratory Failure Inpatient Admission');
    await seedPolicy('COPD Exacerbation Management');

    const res = await app.inject({
      method: 'GET',
      url: '/api/policies',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it('returns policy data with expected fields', async () => {
    await seedPolicy('Acute Respiratory Failure Inpatient Admission', {
      cms_id: 'L35056',
      policy_type: 'LCD',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/policies',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBeGreaterThanOrEqual(1);

    const policy = body[0];
    // Accept either snake_case or camelCase field names
    const title = policy.title;
    const policyType = policy.policy_type ?? policy.policyType;
    const cmsId = policy.cms_id ?? policy.cmsId;

    expect(title).toBeTruthy();
    expect(policyType).toBe('LCD');
    expect(cmsId).toBe('L35056');
  });
});
