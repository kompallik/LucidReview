import type { FastifyInstance } from 'fastify';
import * as ReviewService from '../services/review.service.js';
import * as AgentRunService from '../services/agent-run.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const reviewObjectSchema = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    case_number: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'in_review', 'decided', 'appealed'] },
    determination: { type: 'string' },
    urgency: { type: 'string' },
    service_type: { type: 'string' },
    reviewer_id: { type: 'string' },
    override_reason: { type: 'string' },
    reviewer_notes: { type: 'string' },
    latest_run_id: { type: 'string' },
    decided_at: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
};

export default async function reviewsRoutes(app: FastifyInstance) {
  // GET /api/reviews — list reviews, optional ?status= filter
  app.get<{ Querystring: { status?: string } }>(
    '/api/reviews',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Reviews'],
        summary: 'List reviews',
        description: 'Returns all reviews, optionally filtered by status.',
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Filter by review status' },
          },
        },
        response: {
          200: {
            description: 'Array of review objects',
            type: 'array',
            items: reviewObjectSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const { status } = request.query;
      const reviews = await ReviewService.listReviews({ status });
      return reply.send(reviews);
    },
  );

  // GET /api/reviews/:caseNumber — single review by case number
  app.get<{ Params: { caseNumber: string } }>(
    '/api/reviews/:caseNumber',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Reviews'],
        summary: 'Get review',
        description: 'Returns a single review by case number.',
        params: {
          type: 'object',
          properties: {
            caseNumber: { type: 'string', description: 'The case number of the review' },
          },
          required: ['caseNumber'],
        },
        response: {
          200: {
            description: 'Review object',
            ...reviewObjectSchema,
          },
          404: {
            description: 'Review not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { caseNumber } = request.params;
      const review = await ReviewService.getReview(caseNumber);

      if (!review) {
        return reply.status(404).send({ error: 'Review not found' });
      }

      return reply.send(review);
    },
  );

  // POST /api/reviews/:caseNumber/agent-run — trigger an agent review
  app.post<{ Params: { caseNumber: string } }>(
    '/api/reviews/:caseNumber/agent-run',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Reviews'],
        summary: 'Trigger agent review',
        description: 'Starts an AI agent review run for the specified case.',
        params: {
          type: 'object',
          properties: {
            caseNumber: { type: 'string', description: 'The case number of the review' },
          },
          required: ['caseNumber'],
        },
        response: {
          201: {
            description: 'Agent run created',
            type: 'object',
            additionalProperties: true,
            properties: {
              runId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          404: {
            description: 'Review not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { caseNumber } = request.params;

      const review = await ReviewService.getReview(caseNumber);
      if (!review) {
        return reply.status(404).send({ error: 'Review not found' });
      }

      const { runId, status } = await AgentRunService.createAndRun(caseNumber);
      return reply.status(201).send({ runId, status });
    },
  );

  // POST /api/reviews/:caseNumber/determination — record a human determination
  app.post<{
    Params: { caseNumber: string };
    Body: {
      determination: string;
      reviewerId: string;
      notes?: string;
      overrideReason?: string;
    };
  }>(
    '/api/reviews/:caseNumber/determination',
    {
      preHandler: [authenticate, requireRole(['NURSE_REVIEWER', 'MD_REVIEWER', 'ADMIN'])],
      schema: {
        tags: ['Reviews'],
        summary: 'Record determination',
        description: 'Records a human reviewer determination for the specified case.',
        params: {
          type: 'object',
          properties: {
            caseNumber: { type: 'string', description: 'The case number of the review' },
          },
          required: ['caseNumber'],
        },
        body: {
          type: 'object',
          properties: {
            determination: { type: 'string', description: 'The determination decision' },
            reviewerId: { type: 'string', description: 'ID of the reviewer' },
            notes: { type: 'string', description: 'Optional reviewer notes' },
            overrideReason: { type: 'string', description: 'Reason for overriding agent recommendation' },
          },
          required: ['determination', 'reviewerId'],
        },
        response: {
          201: {
            description: 'Updated review object',
            ...reviewObjectSchema,
          },
          404: {
            description: 'Review not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { caseNumber } = request.params;
      const { determination, reviewerId, notes, overrideReason } = request.body;

      const review = await ReviewService.getReview(caseNumber);
      if (!review) {
        return reply.status(404).send({ error: 'Review not found' });
      }

      const updated = await ReviewService.recordDetermination(
        caseNumber,
        determination,
        reviewerId,
        notes,
        overrideReason,
      );

      return reply.status(201).send(updated);
    },
  );
}
