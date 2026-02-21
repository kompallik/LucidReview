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
      const policies = await db('policies').select(
        'id',
        'policy_type',
        'cms_id',
        'title',
        'status',
        'effective_date',
      );
      return reply.send(policies);
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
      const policy = await db('policies')
        .where({ id })
        .first();

      if (!policy) {
        return reply.status(404).send({ error: 'Policy not found' });
      }

      return reply.send(policy);
    },
  );
}
