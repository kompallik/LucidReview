/**
 * Da Vinci PAS — FHIR Prior Authorization Submission endpoints.
 */
import type { FastifyInstance } from 'fastify';
import * as PasService from '../services/pas.service.js';

export default async function pasRoutes(app: FastifyInstance) {
  // POST /api/fhir/r4/Claim/$submit — submit a prior authorization request
  app.post<{ Body: Record<string, unknown> }>(
    '/api/fhir/r4/Claim/$submit',
    {
      schema: {
        tags: ['Da Vinci PAS'],
        summary: 'Submit prior authorization (PAS)',
        description: 'Submits a prior authorization request as a FHIR Bundle containing a Claim resource.',
        body: {
          type: 'object',
          additionalProperties: true,
          description: 'FHIR Bundle (application/fhir+json) containing a Claim resource',
        },
        response: {
          201: {
            description: 'FHIR Bundle (application/fhir+json) containing a ClaimResponse',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid request body',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const bundle = request.body;
      if (!bundle || bundle.resourceType !== 'Bundle') {
        return reply.status(400).send({ error: 'Request body must be a FHIR Bundle' });
      }
      const response = await PasService.submitPriorAuth(bundle as never);
      return reply
        .status(201)
        .header('Content-Type', 'application/fhir+json')
        .send(response);
    },
  );

  // GET /api/fhir/r4/ClaimResponse/:id — retrieve a ClaimResponse
  app.get<{ Params: { id: string } }>(
    '/api/fhir/r4/ClaimResponse/:id',
    {
      schema: {
        tags: ['Da Vinci PAS'],
        summary: 'Get ClaimResponse',
        description: 'Retrieves a ClaimResponse resource by its ID.',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ClaimResponse ID' },
          },
          required: ['id'],
        },
        response: {
          200: {
            description: 'FHIR Bundle (application/fhir+json)',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'ClaimResponse not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      try {
        const bundle = await PasService.getClaimResponse(id);
        return reply.header('Content-Type', 'application/fhir+json').send(bundle);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        return reply.status(code ?? 500).send({ error: (err as Error).message });
      }
    },
  );

  // POST /api/fhir/r4/ClaimResponse/$inquire — inquiry for status
  app.post<{ Body: { claimId: string } }>(
    '/api/fhir/r4/ClaimResponse/$inquire',
    {
      schema: {
        tags: ['Da Vinci PAS'],
        summary: 'Inquire prior auth status',
        description: 'Inquires about the status of a previously submitted prior authorization.',
        body: {
          type: 'object',
          properties: {
            claimId: { type: 'string', description: 'Claim ID to inquire about' },
          },
          required: ['claimId'],
        },
        response: {
          200: {
            description: 'FHIR Bundle (application/fhir+json)',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Missing claimId',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { claimId } = request.body;
      if (!claimId) return reply.status(400).send({ error: 'claimId is required' });
      try {
        const bundle = await PasService.inquirePriorAuth(claimId);
        return reply.header('Content-Type', 'application/fhir+json').send(bundle);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        return reply.status(code ?? 500).send({ error: (err as Error).message });
      }
    },
  );
}
