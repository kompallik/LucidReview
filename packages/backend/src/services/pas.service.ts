/**
 * Da Vinci PAS (Prior Authorization Submission) service.
 * Accepts FHIR Claim bundles and returns ClaimResponse bundles.
 */
import { randomUUID } from 'crypto';
import { db } from '../db/connection.js';
import * as ReviewService from './review.service.js';
import * as AgentRunService from './agent-run.service.js';

export interface FhirBundle {
  resourceType: 'Bundle';
  id?: string;
  type: string;
  entry?: Array<{ resource?: Record<string, unknown> }>;
}

function findResourceByType(bundle: FhirBundle, resourceType: string): Record<string, unknown> | undefined {
  return bundle.entry?.find((e) => e.resource?.resourceType === resourceType)?.resource;
}

function buildClaimResponse(
  claimId: string | undefined,
  caseNumber: string,
  status: 'queued' | 'approved' | 'denied' | 'pended',
  determination?: string,
): FhirBundle {
  const outcomeMap: Record<string, string> = {
    queued: 'queued',
    approved: 'complete',
    denied: 'error',
    pended: 'partial',
  };

  return {
    resourceType: 'Bundle',
    id: randomUUID(),
    type: 'collection',
    entry: [
      {
        resource: {
          resourceType: 'ClaimResponse',
          id: randomUUID(),
          status: 'active',
          use: 'preauthorization',
          outcome: outcomeMap[status] ?? 'queued',
          created: new Date().toISOString(),
          request: claimId ? { reference: `Claim/${claimId}` } : undefined,
          extension: [
            {
              url: 'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/extension-reviewAction',
              extension: [
                { url: 'number', valueString: caseNumber },
                { url: 'code', valueCodeableConcept: { coding: [{ code: determination ?? 'pended' }] } },
              ],
            },
          ],
        },
      },
    ],
  };
}

export async function submitPriorAuth(bundle: FhirBundle): Promise<FhirBundle> {
  const claim = findResourceByType(bundle, 'Claim');
  const claimId = (claim?.id as string) ?? randomUUID();
  const caseNumber = `PA-${Date.now()}`;

  // Create a LucidReview review record
  await ReviewService.getOrCreateReview(caseNumber);

  // Persist the PAS request
  const pasId = randomUUID();
  await db('pas_requests').insert({
    id: pasId,
    claim_id: claimId,
    case_number: caseNumber,
    request_bundle_json: JSON.stringify(bundle),
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Trigger async agent review
  const { runId } = await AgentRunService.createAndRun(caseNumber);

  // Return a 'pended' ClaimResponse — async review in progress
  const responseBundle = buildClaimResponse(claimId, caseNumber, 'queued');

  // Store initial response
  await db('pas_requests')
    .where({ id: pasId })
    .update({ response_bundle_json: JSON.stringify(responseBundle), updated_at: new Date() });

  // Attach runId to response for polling
  (responseBundle.entry![0].resource as Record<string, unknown>)['_lucidreview_run_id'] = runId;

  return responseBundle;
}

export async function getClaimResponse(pasId: string): Promise<FhirBundle> {
  const pasRequest = await db('pas_requests').where({ id: pasId }).first();
  if (!pasRequest) throw Object.assign(new Error('PAS request not found'), { statusCode: 404 });

  const responseBundle = pasRequest.response_bundle_json
    ? JSON.parse(pasRequest.response_bundle_json)
    : buildClaimResponse(pasRequest.claim_id, pasRequest.case_number, 'pended');

  return responseBundle;
}

export async function inquirePriorAuth(claimId: string): Promise<FhirBundle> {
  const pasRequest = await db('pas_requests').where({ claim_id: claimId }).first();
  if (!pasRequest) throw Object.assign(new Error('PAS request not found'), { statusCode: 404 });

  return getClaimResponse(pasRequest.id);
}
