import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Determination types:
 * - AUTO_APPROVE: All criteria MET with high confidence → safe for auto-approval
 * - MD_REVIEW: Needs physician review (missing data, low confidence, or NOT_MET criteria)
 * - MORE_INFO: Missing data prevents evaluation → request additional info
 * - DENY: NOT_MET with very high confidence (conservative — rarely used)
 */
type DeterminationType = 'AUTO_APPROVE' | 'MD_REVIEW' | 'MORE_INFO' | 'DENY';

const criteriaResultSchema = z.object({
  name: z.string(),
  result: z.enum(['MET', 'NOT_MET', 'UNKNOWN']),
  value: z.unknown().optional(),
  evidence: z.string().optional(),
});

const policyBasisSchema = z.object({
  policyId: z.union([z.string(), z.number()]),
  title: z.string(),
  cmsId: z.string().nullish(),  // DB field is nullable; accept null, undefined, or string
});

export function registerProposeDetermination(server: McpServer) {
  server.tool(
    'propose_determination',
    'Propose a determination based on criteria evaluation results. Uses conservative deterministic logic: all MET → AUTO_APPROVE, any UNKNOWN with missing data → MORE_INFO, NOT_MET → MD_REVIEW. Never denies without very high confidence.',
    {
      caseNumber: z.string().describe('The UM case number'),
      criteriaResults: z
        .array(criteriaResultSchema)
        .describe('Results from CQL criteria evaluation'),
      policyBasis: z
        .array(policyBasisSchema)
        .describe('Policies used as basis for the determination'),
    },
    async ({ caseNumber, criteriaResults, policyBasis }) => {
      const metCount = criteriaResults.filter((r) => r.result === 'MET').length;
      const notMetCount = criteriaResults.filter((r) => r.result === 'NOT_MET').length;
      const unknownCount = criteriaResults.filter((r) => r.result === 'UNKNOWN').length;
      const totalCriteria = criteriaResults.length;

      let determination: DeterminationType;
      let confidence: number;
      let rationale: string;

      if (totalCriteria === 0) {
        // No criteria to evaluate
        determination = 'MD_REVIEW';
        confidence = 0;
        rationale =
          'No criteria were evaluated. Manual physician review is required.';
      } else if (metCount === totalCriteria) {
        // All criteria MET → AUTO_APPROVE
        determination = 'AUTO_APPROVE';
        confidence = 0.95;
        rationale = `All ${totalCriteria} criteria are MET. Case meets coverage requirements per policy.`;
      } else if (unknownCount > 0) {
        // Any UNKNOWN → need more info or MD review
        if (notMetCount === 0) {
          determination = 'MORE_INFO';
          confidence = 0.5;
          rationale = `${metCount}/${totalCriteria} criteria MET, ${unknownCount} UNKNOWN due to missing data. Additional clinical information is needed to complete evaluation.`;
        } else {
          determination = 'MD_REVIEW';
          confidence = 0.4;
          rationale = `${metCount}/${totalCriteria} criteria MET, ${notMetCount} NOT_MET, ${unknownCount} UNKNOWN. Mixed results with missing data require physician review.`;
        }
      } else if (notMetCount > 0 && metCount === 0) {
        // All NOT_MET — still conservative, recommend MD_REVIEW not DENY
        determination = 'MD_REVIEW';
        confidence = 0.7;
        rationale = `No criteria are MET (${notMetCount}/${totalCriteria} NOT_MET). Physician review required before any adverse determination.`;
      } else {
        // Mix of MET and NOT_MET, no UNKNOWN
        determination = 'MD_REVIEW';
        confidence = 0.6;
        rationale = `${metCount}/${totalCriteria} criteria MET, ${notMetCount} NOT_MET. Partial criteria fulfillment requires physician review.`;
      }

      const result = {
        caseNumber,
        determination,
        confidence,
        rationale,
        criteriasSummary: {
          total: totalCriteria,
          met: metCount,
          notMet: notMetCount,
          unknown: unknownCount,
        },
        criteriaResults,
        policyBasis,
        timestamp: new Date().toISOString(),
        note: 'This is a system-generated recommendation. Final determination requires human reviewer approval.',
      };

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
