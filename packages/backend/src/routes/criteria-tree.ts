import type { FastifyInstance } from 'fastify';
import { getCriteriaTree } from '../services/criteria-tree.service.js';
import { db } from '../db/connection.js';

export default async function criteriaTreeRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { icd10?: string; cpt?: string; serviceType?: string; synthesize?: string };
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
      const { icd10, cpt, serviceType, synthesize } = request.query;

      if (!icd10 && !cpt) {
        return reply
          .status(400)
          .send({ error: 'Provide at least one of: icd10, cpt' });
      }

      const results = await getCriteriaTree({ icd10, cpt, serviceType, synthesize: synthesize === 'true' });
      return reply.send(results);
    },
  );

  /**
   * GET /api/criteria-combos
   * Returns a flat list of all active policies with their primary ICD-10 code,
   * primary CPT code, and scope — used to populate the "All Combos" help modal.
   * Supports optional ?q= text search and ?setting= filter.
   */
  app.get<{ Querystring: { q?: string; setting?: string } }>(
    '/api/criteria-combos',
    {
      schema: {
        tags: ['Criteria'],
        summary: 'List all available ICD-10 + CPT + setting combos',
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Text search across policy title, codes' },
            setting: { type: 'string', description: 'Filter by scope setting' },
          },
        },
      },
    },
    async (request, reply) => {
      const { q, setting } = request.query;

      const rows = await db('criteria_sets as cs')
        .join('policies as p', 'cs.policy_id', 'p.id')
        .where('p.status', 'ACTIVE')
        .where('cs.status', 'ACTIVE')
        .whereNotNull('cs.procedure_codes')
        .modify((qb) => {
          if (setting) qb.where('cs.scope_setting', setting.toUpperCase());
        })
        .select(
          'p.id as policy_id', 'p.policy_type', 'p.cms_id', 'p.title as policy_title',
          'cs.id as cs_id', 'cs.criteria_set_id', 'cs.scope_setting', 'cs.scope_request_type',
          'cs.procedure_codes', 'p.sections_json',
        )
        .orderBy('p.policy_type').orderBy('cs.scope_setting').orderBy('p.title');

      // Build combo objects: one per criteria set, using first ICD-10 and first CPT
      const combos = rows.flatMap((row) => {
        const sections = typeof row.sections_json === 'string'
          ? JSON.parse(row.sections_json as string)
          : (row.sections_json as Record<string, unknown> ?? {});
        const diagCodes: string[] = (sections.diagnosisCodes as string[] ?? []).slice(0, 5);
        const procCodes: string[] = (typeof row.procedure_codes === 'string'
          ? JSON.parse(row.procedure_codes as string)
          : (row.procedure_codes as string[] ?? [])).slice(0, 3);

        if (diagCodes.length === 0 || procCodes.length === 0) return [];

        // Emit one entry per (primary ICD-10, primary CPT) pair — keep it concise
        return [{
          policyId: row.policy_id,
          policyTitle: row.policy_title,
          policyType: row.policy_type,
          cmsId: row.cms_id ?? null,
          criteriaSetId: row.criteria_set_id,
          scopeSetting: row.scope_setting,
          scopeRequestType: row.scope_request_type,
          icd10: diagCodes[0],
          allIcd10: diagCodes,
          cpt: procCodes[0],
          allCpt: procCodes,
        }];
      });

      // Text search
      const filtered = q
        ? combos.filter((c) => {
            const term = q.toLowerCase();
            return (
              c.policyTitle.toLowerCase().includes(term) ||
              c.icd10.toLowerCase().includes(term) ||
              c.cpt.toLowerCase().includes(term) ||
              (c.cmsId ?? '').toLowerCase().includes(term) ||
              c.allIcd10.some((code) => code.toLowerCase().includes(term)) ||
              c.allCpt.some((code) => code.toLowerCase().includes(term))
            );
          })
        : combos;

      return reply.send({ total: filtered.length, combos: filtered });
    },
  );
}
