import { z } from 'zod';

export const EvidenceItemSchema = z.object({
  fhirRef: z.string(),
  path: z.string(),
  valueSeen: z.union([z.string(), z.number(), z.boolean()]),
  effectiveTime: z.string().optional(),
  sourceDoc: z
    .object({
      documentReference: z.string(),
      offsetStart: z.number().optional(),
      offsetEnd: z.number().optional(),
      quoteHash: z.string().optional(),
      excerpt: z.string().optional(),
    })
    .optional(),
  assertion: z.enum(['AFFIRMED', 'NEGATED', 'UNCERTAIN']).optional(),
  extractedBy: z.enum(['STRUCTURED', 'NLP', 'MANUAL']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const CriteriaResultSchema = z.object({
  criterionId: z.string(),
  description: z.string(),
  status: z.enum(['MET', 'NOT_MET', 'UNKNOWN']),
  evidence: z.array(EvidenceItemSchema),
  evaluatedBy: z.enum(['CQL', 'NLP', 'LLM', 'MANUAL']),
  confidence: z.number().min(0).max(1).optional(),
});

export const PolicyBasisSchema = z.object({
  policyType: z.enum(['NCD', 'LCD', 'ARTICLE', 'INTERNAL']),
  policyId: z.string(),
  policyTitle: z.string().optional(),
  policyVersion: z.string().optional(),
});

export const MissingInfoRequestSchema = z.object({
  questionId: z.string(),
  question: z.string(),
  dataElement: z.string(),
  reason: z.string(),
});

export const DeterminationResultSchema = z.object({
  determination: z.enum(['AUTO_APPROVE', 'MD_REVIEW', 'DENY', 'MORE_INFO']),
  confidence: z.number().min(0).max(1),
  policyBasis: z.array(PolicyBasisSchema),
  criteriaResults: z.array(CriteriaResultSchema),
  denialOrEscalationRationale: z
    .object({
      summary: z.string(),
      missingInfoRequests: z.array(MissingInfoRequestSchema).optional(),
    })
    .optional(),
  rationaleNarrative: z.string().optional(),
  audit: z.object({
    cqlLibraryVersion: z.string().optional(),
    artifactBundleId: z.string().optional(),
    llm: z
      .object({
        model: z.string(),
        promptVersion: z.string(),
        inputHash: z.string(),
        outputHash: z.string(),
      })
      .optional(),
  }),
});

export type EvidenceItemInput = z.input<typeof EvidenceItemSchema>;
export type CriteriaResultInput = z.input<typeof CriteriaResultSchema>;
export type DeterminationResultInput = z.input<typeof DeterminationResultSchema>;
