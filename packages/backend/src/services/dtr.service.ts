/**
 * Da Vinci DTR (Documentation Templates and Rules) service.
 * Retrieves FHIR Questionnaires and CQL libraries for documentation requirements.
 */
import { db } from '../db/connection.js';

const HAPI_FHIR_URL = process.env.HAPI_FHIR_URL ?? 'http://localhost:8080/fhir';

export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

/**
 * Fetch a FHIR resource from the HAPI FHIR server.
 */
async function fetchFhirResource(path: string): Promise<FhirResource> {
  const resp = await fetch(`${HAPI_FHIR_URL}/${path}`, {
    headers: { Accept: 'application/fhir+json' },
  });
  if (!resp.ok) {
    throw new Error(`HAPI FHIR returned ${resp.status} for ${path}`);
  }
  return resp.json() as Promise<FhirResource>;
}

/**
 * Get the FHIR Questionnaire for a given criteria set.
 */
export async function getQuestionnaire(criteriaSetId: string): Promise<FhirResource> {
  const criteriaSet = await db('criteria_sets').where({ id: criteriaSetId }).first();
  if (!criteriaSet) throw Object.assign(new Error('Criteria set not found'), { statusCode: 404 });

  if (criteriaSet.questionnaire_fhir_id) {
    return fetchFhirResource(`Questionnaire/${criteriaSet.questionnaire_fhir_id}`);
  }

  // Return a stub questionnaire when none is configured
  return {
    resourceType: 'Questionnaire',
    id: `stub-${criteriaSetId}`,
    status: 'draft',
    title: criteriaSet.title,
    description: 'Documentation questionnaire (auto-generated stub — configure questionnaire_fhir_id to link a real questionnaire)',
    item: [
      {
        linkId: '1',
        text: 'Clinical documentation supporting medical necessity',
        type: 'text',
        required: true,
      },
    ],
  };
}

/**
 * Get the FHIR Library (CQL) for a given criteria set.
 */
export async function getCqlLibrary(criteriaSetId: string): Promise<FhirResource> {
  const criteriaSet = await db('criteria_sets').where({ id: criteriaSetId }).first();
  if (!criteriaSet) throw Object.assign(new Error('Criteria set not found'), { statusCode: 404 });

  if (criteriaSet.cql_library_fhir_id) {
    return fetchFhirResource(`Library/${criteriaSet.cql_library_fhir_id}`);
  }

  return {
    resourceType: 'Library',
    id: `stub-${criteriaSetId}`,
    status: 'draft',
    title: criteriaSet.title,
    type: { coding: [{ code: 'logic-library' }] },
    description: 'CQL library stub — configure cql_library_fhir_id to link a real CQL library',
  };
}

/**
 * Pre-populate a QuestionnaireResponse from patient data.
 */
export async function populateQuestionnaire(
  criteriaSetId: string,
  patientBundle: FhirResource,
): Promise<FhirResource> {
  const questionnaire = await getQuestionnaire(criteriaSetId);

  // Build a basic pre-populated QuestionnaireResponse
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'in-progress',
    questionnaire: `Questionnaire/${questionnaire.id}`,
    authored: new Date().toISOString(),
    item: [], // Client fills in items based on questionnaire definition
    extension: [
      {
        url: 'http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/context',
        valueReference: { reference: `Bundle/${(patientBundle as {id?: string}).id ?? 'unknown'}` },
      },
    ],
  };
}
