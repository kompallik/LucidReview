/**
 * Da Vinci DTR — FHIR Questionnaire and CQL library endpoints.
 */
import type { FastifyInstance } from 'fastify';
import * as DtrService from '../services/dtr.service.js';

export default async function dtrRoutes(app: FastifyInstance) {
  // GET /api/dtr/questionnaire/:criteriaSetId
  app.get<{ Params: { criteriaSetId: string } }>(
    '/api/dtr/questionnaire/:criteriaSetId',
    {
      schema: {
        tags: ['Da Vinci DTR'],
        summary: 'Get FHIR Questionnaire',
        description: 'Returns a FHIR Questionnaire resource for the specified criteria set.',
        params: {
          type: 'object',
          properties: {
            criteriaSetId: { type: 'string', description: 'Criteria set identifier' },
          },
          required: ['criteriaSetId'],
        },
        response: {
          200: {
            description: 'FHIR Questionnaire (application/fhir+json)',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Questionnaire not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { criteriaSetId } = request.params;
      try {
        const questionnaire = await DtrService.getQuestionnaire(criteriaSetId);
        return reply.header('Content-Type', 'application/fhir+json').send(questionnaire);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        return reply.status(code ?? 500).send({ error: (err as Error).message });
      }
    },
  );

  // GET /api/dtr/library/:criteriaSetId
  app.get<{ Params: { criteriaSetId: string } }>(
    '/api/dtr/library/:criteriaSetId',
    {
      schema: {
        tags: ['Da Vinci DTR'],
        summary: 'Get CQL Library',
        description: 'Returns a FHIR Library resource containing CQL logic for the specified criteria set.',
        params: {
          type: 'object',
          properties: {
            criteriaSetId: { type: 'string', description: 'Criteria set identifier' },
          },
          required: ['criteriaSetId'],
        },
        response: {
          200: {
            description: 'FHIR Library (application/fhir+json)',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Library not found',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { criteriaSetId } = request.params;
      try {
        const library = await DtrService.getCqlLibrary(criteriaSetId);
        return reply.header('Content-Type', 'application/fhir+json').send(library);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        return reply.status(code ?? 500).send({ error: (err as Error).message });
      }
    },
  );

  // POST /api/dtr/questionnaire/$populate
  app.post<{ Body: { criteriaSetId: string; patientBundle: Record<string, unknown> } }>(
    '/api/dtr/questionnaire/$populate',
    {
      schema: {
        tags: ['Da Vinci DTR'],
        summary: 'Pre-populate QuestionnaireResponse',
        description: 'Pre-populates a QuestionnaireResponse using patient data and CQL evaluation.',
        body: {
          type: 'object',
          properties: {
            criteriaSetId: { type: 'string', description: 'Criteria set identifier' },
            patientBundle: { type: 'object', additionalProperties: true, description: 'FHIR Bundle with patient data' },
          },
          required: ['criteriaSetId', 'patientBundle'],
        },
        response: {
          200: {
            description: 'FHIR QuestionnaireResponse (application/fhir+json)',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Missing required fields',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { criteriaSetId, patientBundle } = request.body;
      if (!criteriaSetId || !patientBundle) {
        return reply.status(400).send({ error: 'criteriaSetId and patientBundle are required' });
      }
      try {
        const response = await DtrService.populateQuestionnaire(criteriaSetId, patientBundle as never);
        return reply.header('Content-Type', 'application/fhir+json').send(response);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        return reply.status(code ?? 500).send({ error: (err as Error).message });
      }
    },
  );
}
