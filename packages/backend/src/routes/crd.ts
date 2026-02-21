/**
 * Da Vinci CRD — CDS Hooks server endpoints.
 * Implements the CDS Hooks discovery and hook-callback endpoints.
 */
import type { FastifyInstance } from 'fastify';
import { evaluateCoverageRequirements } from '../services/crd.service.js';

export default async function crdRoutes(app: FastifyInstance) {
  // CDS Hooks discovery endpoint — lists available hooks
  app.get(
    '/cds-hooks',
    {
      schema: {
        tags: ['Da Vinci CRD'],
        summary: 'CDS Hooks service discovery',
        description: 'Returns the list of CDS Hooks services supported by this server.',
        response: {
          200: {
            description: 'CDS Hooks discovery response',
            type: 'object',
            additionalProperties: true,
            properties: {
              services: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true,
                  properties: {
                    hook: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    id: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.send({
        services: [
          {
            hook: 'order-select',
            title: 'LucidReview Coverage Requirements Discovery',
            description: 'Checks coverage requirements and prior authorization needs when a provider selects an order.',
            id: 'lucidreview-crd-order-select',
            prefetch: {
              patient: 'Patient/{{context.patientId}}',
              coverage: 'Coverage?patient={{context.patientId}}&status=active',
            },
          },
          {
            hook: 'order-dispatch',
            title: 'LucidReview Coverage Requirements at Dispatch',
            description: 'Checks coverage requirements when a signed order is dispatched to a performer.',
            id: 'lucidreview-crd-order-dispatch',
          },
        ],
      });
    },
  );

  // CDS Hooks order-select callback
  app.post<{ Body: { hook: string; hookInstance: string; context: Record<string, unknown>; prefetch?: unknown } }>(
    '/cds-hooks/crd/order-select',
    {
      schema: {
        tags: ['Da Vinci CRD'],
        summary: 'CDS Hooks: order-select callback',
        description: 'Handles the CDS Hooks order-select callback to evaluate coverage requirements.',
        body: {
          type: 'object',
          additionalProperties: true,
          properties: {
            hook: { type: 'string', description: 'The hook that triggered this request' },
            hookInstance: { type: 'string', description: 'Unique instance identifier' },
            context: { type: 'object', additionalProperties: true, description: 'Hook context data' },
            prefetch: { type: 'object', additionalProperties: true, description: 'Prefetched FHIR resources' },
          },
          required: ['hook', 'hookInstance', 'context'],
        },
        response: {
          200: {
            description: 'CDS Hooks response with cards',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const { hook, hookInstance, context } = request.body;
      const response = await evaluateCoverageRequirements(
        hook ?? 'order-select',
        hookInstance ?? '',
        context as never,
      );
      return reply.send(response);
    },
  );

  // CDS Hooks order-dispatch callback
  app.post<{ Body: { hook: string; hookInstance: string; context: Record<string, unknown> } }>(
    '/cds-hooks/crd/order-dispatch',
    {
      schema: {
        tags: ['Da Vinci CRD'],
        summary: 'CDS Hooks: order-dispatch callback',
        description: 'Handles the CDS Hooks order-dispatch callback to evaluate coverage requirements at dispatch.',
        body: {
          type: 'object',
          additionalProperties: true,
          properties: {
            hook: { type: 'string', description: 'The hook that triggered this request' },
            hookInstance: { type: 'string', description: 'Unique instance identifier' },
            context: { type: 'object', additionalProperties: true, description: 'Hook context data' },
          },
          required: ['hook', 'hookInstance', 'context'],
        },
        response: {
          200: {
            description: 'CDS Hooks response with cards',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const { hook, hookInstance, context } = request.body;
      const response = await evaluateCoverageRequirements(
        hook ?? 'order-dispatch',
        hookInstance ?? '',
        context as never,
      );
      return reply.send(response);
    },
  );
}
