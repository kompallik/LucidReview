/**
 * Da Vinci CRD (Coverage Requirements Discovery) service.
 * Evaluates whether coverage requirements and prior authorization apply
 * for a given clinical order context (CDS Hooks format).
 */
import { randomUUID } from 'crypto';
import { db } from '../db/connection.js';

export interface CdsHooksContext {
  patientId?: string;
  userId?: string;
  serviceRequest?: {
    resourceType: string;
    code?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
    subject?: { reference?: string };
  };
  medications?: unknown[];
  draftOrders?: {
    entry?: Array<{ resource?: { resourceType?: string; code?: { coding?: Array<{ code?: string }> } } }>;
  };
}

export interface CdsCard {
  uuid: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: { label: string; url?: string };
  suggestions?: Array<{ label: string; actions?: unknown[] }>;
  links?: Array<{ label: string; url: string; type: 'absolute' | 'smart' }>;
}

export interface CdsHooksResponse {
  cards: CdsCard[];
}

/**
 * Extract service/diagnosis codes from CDS Hooks order context.
 */
function extractCodesFromContext(context: CdsHooksContext): string[] {
  const codes: string[] = [];
  // From draftOrders entries
  if (context.draftOrders?.entry) {
    for (const entry of context.draftOrders.entry) {
      const codings = entry.resource?.code?.coding ?? [];
      for (const coding of codings) {
        if (coding.code) codes.push(coding.code);
      }
    }
  }
  // From direct serviceRequest
  if (context.serviceRequest?.code?.coding) {
    for (const coding of context.serviceRequest.code.coding) {
      if (coding.code) codes.push(coding.code);
    }
  }
  return codes;
}

/**
 * Evaluate coverage requirements for a CDS Hooks order context.
 * Returns CDS cards with PA requirements and documentation links.
 */
export async function evaluateCoverageRequirements(
  hookType: string,
  hookInstance: string,
  context: CdsHooksContext,
): Promise<CdsHooksResponse> {
  const startMs = Date.now();
  const codes = extractCodesFromContext(context);

  // Look up active policies that might match these codes
  const policies = await db('policies')
    .where({ status: 'ACTIVE' })
    .select('id', 'title', 'cms_id', 'policy_type', 'sections_json')
    .limit(10);

  const cards: CdsCard[] = [];

  if (policies.length === 0 || codes.length === 0) {
    // No applicable policy found — return informational card
    cards.push({
      uuid: randomUUID(),
      summary: 'No coverage restrictions identified',
      detail: 'No active coverage policies were found for this order. Standard coverage criteria apply.',
      indicator: 'info',
      source: { label: 'LucidReview Coverage Engine' },
    });
  } else {
    for (const policy of policies) {
      const criteriaSet = await db('criteria_sets')
        .where({ policy_id: policy.id, status: 'ACTIVE' })
        .first();

      cards.push({
        uuid: randomUUID(),
        summary: `Prior authorization may be required — ${policy.title}`,
        detail: `This order may require prior authorization per ${policy.policy_type} policy${policy.cms_id ? ` (${policy.cms_id})` : ''}. Please complete the required documentation.`,
        indicator: 'warning',
        source: {
          label: 'LucidReview Coverage Engine',
          url: policy.cms_id
            ? `https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=${policy.cms_id}`
            : undefined,
        },
        links: criteriaSet?.questionnaire_fhir_id
          ? [
              {
                label: 'Complete Documentation (DTR)',
                url: `/api/dtr/questionnaire/${criteriaSet.id}`,
                type: 'absolute' as const,
              },
            ]
          : [],
      });
    }
  }

  // Log the CDS Hooks call
  await db('cds_hooks_calls').insert({
    id: randomUUID(),
    hook_type: hookType,
    hook_instance: hookInstance,
    context_json: JSON.stringify(context),
    response_json: JSON.stringify({ cards }),
    response_ms: Date.now() - startMs,
    created_at: new Date(),
  });

  return { cards };
}
