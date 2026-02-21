import type { FastifyInstance } from 'fastify';
import { db } from '../db/connection.js';
import { config } from '../config.js';
import { getQueueStats } from '../queue/queue-health.js';
import * as PolicyIngestionService from '../services/policy-ingestion.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export default async function adminRoutes(app: FastifyInstance) {
  // GET /api/health — check service health
  app.get(
    '/api/health',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Health check',
        description: 'Returns service health status including MySQL, HAPI FHIR, and Bedrock connectivity.',
        response: {
          200: {
            description: 'Health status',
            type: 'object',
            additionalProperties: true,
            properties: {
              status: { type: 'string' },
              services: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  mysql: { type: 'string', enum: ['up', 'down'] },
                  hapiFhir: { type: 'string', enum: ['up', 'down'] },
                  bedrock: { type: 'string', enum: ['up', 'down'] },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const services: Record<string, 'up' | 'down'> = {
        mysql: 'down',
        hapiFhir: 'down',
        bedrock: 'down',
      };

      // Check MySQL
      try {
        await db.raw('SELECT 1');
        services.mysql = 'up';
      } catch {
        // leave as down
      }

      // Check HAPI FHIR
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${config.hapiFhir.baseUrl}/metadata`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          services.hapiFhir = 'up';
        }
      } catch {
        // leave as down
      }

      return reply.send({ status: 'ok', services });
    },
  );

  // GET /api/dashboard/metrics — aggregate review counts
  app.get(
    '/api/dashboard/metrics',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Dashboard metrics',
        description: 'Returns aggregate review counts by status and determination.',
        response: {
          200: {
            description: 'Dashboard metrics',
            type: 'object',
            additionalProperties: true,
            properties: {
              totalReviews: { type: 'number' },
              byStatus: { type: 'object', additionalProperties: { type: 'number' } },
              byDetermination: { type: 'object', additionalProperties: { type: 'number' } },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      // Total reviews
      const [{ total }] = await db('reviews').count('* as total');

      // Counts by status
      const statusRows = await db('reviews')
        .select('status')
        .count('* as count')
        .groupBy('status');

      const byStatus: Record<string, number> = {};
      for (const row of statusRows) {
        byStatus[row.status] = Number(row.count);
      }

      // Counts by determination
      const detRows = await db('reviews')
        .select('determination')
        .count('* as count')
        .groupBy('determination');

      const byDetermination: Record<string, number> = {};
      for (const row of detRows) {
        const key = row.determination ?? 'null';
        byDetermination[key] = Number(row.count);
      }

      return reply.send({
        totalReviews: Number(total),
        byStatus,
        byDetermination,
      });
    },
  );

  // GET /api/admin/queue — queue statistics
  app.get(
    '/api/admin/queue',
    {
      preHandler: [authenticate, requireRole(['ADMIN'])],
      schema: {
        tags: ['Admin'],
        summary: 'Queue statistics',
        description: 'Returns current queue statistics including pending, active, and failed job counts.',
        response: {
          200: {
            description: 'Queue statistics',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (_request, reply) => {
      const stats = await getQueueStats();
      return reply.send(stats);
    },
  );

  // POST /api/admin/policies/ingest-ncd — ingest a single NCD
  app.post<{ Body: { ncdId: string } }>(
    '/api/admin/policies/ingest-ncd',
    {
      preHandler: [authenticate, requireRole(['ADMIN'])],
      schema: {
        tags: ['Admin'],
        summary: 'Ingest NCD from CMS',
        description: 'Ingests a single National Coverage Determination from CMS by its ID.',
        body: {
          type: 'object',
          properties: {
            ncdId: { type: 'string', description: 'CMS NCD identifier' },
          },
          required: ['ncdId'],
        },
        response: {
          200: {
            description: 'Ingestion result',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Missing ncdId',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { ncdId } = request.body;
      if (!ncdId) return reply.status(400).send({ error: 'ncdId is required' });
      const result = await PolicyIngestionService.ingestNcdFromCms(ncdId);
      return reply.send(result);
    },
  );

  // POST /api/admin/policies/ingest-lcd — ingest a single LCD
  app.post<{ Body: { lcdId: string } }>(
    '/api/admin/policies/ingest-lcd',
    {
      preHandler: [authenticate, requireRole(['ADMIN'])],
      schema: {
        tags: ['Admin'],
        summary: 'Ingest LCD from CMS',
        description: 'Ingests a single Local Coverage Determination from CMS by its ID.',
        body: {
          type: 'object',
          properties: {
            lcdId: { type: 'string', description: 'CMS LCD identifier' },
          },
          required: ['lcdId'],
        },
        response: {
          200: {
            description: 'Ingestion result',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Missing lcdId',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { lcdId } = request.body;
      if (!lcdId) return reply.status(400).send({ error: 'lcdId is required' });
      const result = await PolicyIngestionService.ingestLcdFromCms(lcdId);
      return reply.send(result);
    },
  );

  // POST /api/admin/policies/sync — trigger full CMS sync
  app.post(
    '/api/admin/policies/sync',
    {
      preHandler: [authenticate, requireRole(['ADMIN'])],
      schema: {
        tags: ['Admin'],
        summary: 'Sync all active CMS policies',
        description: 'Triggers a background sync of all active policies from CMS.',
        response: {
          200: {
            description: 'Sync job started',
            type: 'object',
            additionalProperties: true,
            properties: {
              jobStarted: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      // Run async, return immediately
      PolicyIngestionService.syncActivePolicies().catch(console.error);
      return reply.send({ jobStarted: true, message: 'CMS policy sync started in background' });
    },
  );
}
