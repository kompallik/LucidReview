/**
 * Criteria Decision Tree Service
 *
 * Returns the coverage criteria decision tree for a given set of
 * clinical codes, without requiring a patient/case.
 *
 * GET /api/criteria-tree?icd10=J96.00&cpt=94660&serviceType=INPATIENT
 */
import { db } from '../db/connection.js';

export interface TreeNode {
  id: string;
  label: string;
  description?: string;
  type: 'AND' | 'OR' | 'LEAF';
  dataType?: 'vital' | 'lab' | 'diagnosis' | 'procedure' | 'coverage' | 'clinical_note';
  threshold?: {
    operator: '>' | '<' | '>=' | '<=' | '==' | 'in';
    value?: number | string | string[];
    unit?: string;
    loinc?: string;
    display?: string;
  };
  cqlExpression?: string;
  required: boolean;
  clinicalNotes?: string;
  children?: TreeNode[];
}

export interface CriteriaTreeResult {
  policy: {
    id: string;
    title: string;
    policyType: string;
    cmsId: string | null;
    sourceUrl: string | null;
  };
  criteriaSet: {
    id: string;
    criteriaSetId: string;
    title: string;
    scopeSetting: string;
    scopeRequestType: string;
    cqlLibraryFhirId: string | null;
  };
  tree: TreeNode;
  matchedOn: { diagnosisCodes: string[]; serviceType?: string };
}

export interface CriteriaTreeQuery {
  icd10?: string;           // comma-separated ICD-10 codes, e.g. "J96.00,J44.1"
  cpt?: string;             // CPT code, e.g. "94660"
  serviceType?: string;     // e.g. "INPATIENT", "OUTPATIENT"
}

/** Build a generic fallback tree when no dsl_json is stored */
function buildFallbackTree(title: string): TreeNode {
  return {
    id: 'root',
    type: 'AND',
    label: title,
    required: true,
    children: [
      {
        id: 'coverage',
        type: 'LEAF',
        label: 'Active coverage for service',
        dataType: 'coverage',
        required: true,
      },
      {
        id: 'qualifying_diagnosis',
        type: 'LEAF',
        label: 'Qualifying diagnosis',
        dataType: 'diagnosis',
        required: true,
      },
      {
        id: 'medical_necessity',
        type: 'LEAF',
        label: 'Medical necessity documented',
        dataType: 'clinical_note',
        required: true,
        description: 'Clinical documentation supports the requested service',
      },
    ],
  };
}

export async function getCriteriaTree(
  query: CriteriaTreeQuery,
): Promise<CriteriaTreeResult[]> {
  const inputCodes = (query.icd10 ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  if (inputCodes.length === 0 && !query.cpt) {
    return [];
  }

  // Find active policies whose sections_json diagnosisCodes overlap with input,
  // OR that have any active criteria set matching the service type
  const policies = await db('policies')
    .where({ status: 'ACTIVE' })
    .select('id', 'title', 'policy_type', 'cms_id', 'source_url', 'sections_json');

  const results: CriteriaTreeResult[] = [];

  for (const policy of policies) {
    // Check if policy covers any of the input diagnosis codes
    let matches = false;
    if (inputCodes.length > 0) {
      const sections =
        typeof policy.sections_json === 'string'
          ? JSON.parse(policy.sections_json)
          : (policy.sections_json ?? {});
      const policyCodes: string[] = (sections.diagnosisCodes ?? []).map((c: string) =>
        c.toUpperCase(),
      );
      matches = inputCodes.some((code) =>
        policyCodes.some((pc) => pc === code || code.startsWith(pc) || pc.startsWith(code)),
      );
    }

    if (!matches && !query.cpt) continue;

    // Find matching criteria sets for this policy
    let csQuery = db('criteria_sets')
      .where({ policy_id: policy.id, status: 'ACTIVE' });

    if (query.serviceType) {
      csQuery = csQuery.where({ scope_setting: query.serviceType.toUpperCase() });
    }

    const criteriaSets = await csQuery.select(
      'id', 'criteria_set_id', 'title',
      'scope_setting', 'scope_request_type',
      'cql_library_fhir_id', 'dsl_json',
    );

    for (const cs of criteriaSets) {
      const dsl =
        typeof cs.dsl_json === 'string'
          ? JSON.parse(cs.dsl_json)
          : (cs.dsl_json ?? {});

      // If dsl_json has a 'tree' root node, use it directly
      // If it has the old flat 'criteria' array, convert to tree
      let tree: TreeNode;
      if (dsl.id && (dsl.type === 'AND' || dsl.type === 'OR' || dsl.type === 'LEAF')) {
        tree = dsl as TreeNode;
      } else if (Array.isArray(dsl.criteria)) {
        // Convert flat list to AND tree
        tree = {
          id: 'root',
          type: 'AND',
          label: cs.title,
          required: true,
          children: dsl.criteria.map((c: { id: string; description: string }) => ({
            id: c.id,
            type: 'LEAF' as const,
            label: c.description,
            required: true,
            dataType: 'clinical_note' as const,
          })),
        };
      } else {
        tree = buildFallbackTree(cs.title);
      }

      results.push({
        policy: {
          id: policy.id,
          title: policy.title,
          policyType: policy.policy_type,
          cmsId: policy.cms_id ?? null,
          sourceUrl: policy.source_url ?? null,
        },
        criteriaSet: {
          id: cs.id,
          criteriaSetId: cs.criteria_set_id,
          title: cs.title,
          scopeSetting: cs.scope_setting,
          scopeRequestType: cs.scope_request_type,
          cqlLibraryFhirId: cs.cql_library_fhir_id ?? null,
        },
        tree,
        matchedOn: { diagnosisCodes: inputCodes, serviceType: query.serviceType },
      });
    }
  }

  return results;
}
