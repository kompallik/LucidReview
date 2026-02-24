import type { FastifyInstance } from 'fastify';
import { db } from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const policyObjectSchema = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    policy_type: { type: 'string' },
    cms_id: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'string' },
    effective_date: { type: 'string' },
  },
};

function parseJsonField<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return null; }
  }
  return value as T;
}

/** Serialize a raw DB policies row to camelCase for the frontend. */
function serializePolicy(row: Record<string, unknown>): Record<string, unknown> {
  const d = (v: unknown) =>
    v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? null);
  const ts = (v: unknown) =>
    v instanceof Date ? v.toISOString() : (typeof v === 'string' ? v : null);
  return {
    id: row['id'],
    policyType: row['policy_type'],
    cmsId: row['cms_id'] ?? null,
    cmsDocumentId: row['cms_document_id'] ?? null,
    title: row['title'],
    status: row['status'],
    effectiveDate: d(row['effective_date']),
    retirementDate: d(row['retirement_date']),
    sourceUrl: row['source_url'] ?? null,
    icd10Covered: parseJsonField(row['icd10_covered']),
    icd10Noncovered: parseJsonField(row['icd10_noncovered']),
    hcpcsCodes: parseJsonField(row['hcpcs_codes']),
    lastSyncedAt: ts(row['last_synced_at']),
  };
}

export default async function policiesRoutes(app: FastifyInstance) {
  // GET /api/policies — list all policies
  app.get(
    '/api/policies',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Policies'],
        summary: 'List policies',
        description: 'Returns all coverage determination policies.',
        response: {
          200: {
            description: 'Array of policy objects',
            type: 'array',
            items: policyObjectSchema,
          },
        },
      },
    },
    async (_request, reply) => {
      const policies = await db('policies').select('*').orderBy('policy_type').orderBy('cms_id');
      return reply.send(policies.map(serializePolicy));
    },
  );

  // GET /api/policies/:id — single policy by id
  app.get<{ Params: { id: string } }>(
    '/api/policies/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Policies'],
        summary: 'Get policy',
        description: 'Returns a single policy by its ID.',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Policy ID' },
          },
          required: ['id'],
        },
        response: {
          200: {
            description: 'Policy object',
            ...policyObjectSchema,
          },
          404: {
            description: 'Policy not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const policy = await db('policies').where({ id }).first();

      if (!policy) {
        return reply.status(404).send({ error: 'Policy not found' });
      }

      return reply.send(serializePolicy(policy));
    },
  );
}
