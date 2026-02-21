import type { FastifyInstance } from 'fastify';
import { getCriteriaTree } from '../services/criteria-tree.service.js';

export default async function criteriaTreeRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { icd10?: string; cpt?: string; serviceType?: string };
  }>(
    '/api/criteria-tree',
    {
      schema: {
        tags: ['Criteria'],
        summary: 'Get coverage criteria decision tree',
        description:
          'Returns the coverage criteria decision tree for given diagnosis/procedure codes. ' +
          'Does not require a patient — useful for pre-authorization planning.',
        querystring: {
          type: 'object',
          properties: {
            icd10: {
              type: 'string',
              description: 'Comma-separated ICD-10-CM codes (e.g. "J96.00,J44.1")',
            },
            cpt: {
              type: 'string',
              description: 'CPT/HCPCS procedure code (e.g. "94660")',
            },
            serviceType: {
              type: 'string',
              enum: ['INPATIENT', 'OUTPATIENT', 'DME', 'HOME_HEALTH'],
              description: 'Filter criteria by care setting',
            },
          },
        },
        response: {
          200: {
            description: 'Matching criteria decision trees',
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: {
                policy: { type: 'object', additionalProperties: true },
                criteriaSet: { type: 'object', additionalProperties: true },
                tree: { type: 'object', additionalProperties: true },
                matchedOn: { type: 'object', additionalProperties: true },
              },
            },
          },
          400: {
            description: 'No codes provided',
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { icd10, cpt, serviceType } = request.query;

      if (!icd10 && !cpt) {
        return reply
          .status(400)
          .send({ error: 'Provide at least one of: icd10, cpt' });
      }

      const results = await getCriteriaTree({ icd10, cpt, serviceType });
      return reply.send(results);
    },
  );
}
