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
    procedureCodes: string[] | null;
  };
  tree: TreeNode;
  matchedOn: { diagnosisCodes: string[]; serviceType?: string };
  /** 0–100: how specifically this policy targets the input codes (vs just listing them as comorbidities) */
  relevanceScore: number;
  /** true when the input code appears in the first 3 positions of the policy's diagnosisCodes list */
  isPrimary: boolean;
}

export interface CriteriaTreeQuery {
  icd10?: string;           // comma-separated ICD-10 codes, e.g. "J96.00,J44.1"
  cpt?: string;             // CPT code, e.g. "94660"
  synthesize?: boolean;     // when true, LLM synthesizes N results into 1 authoritative tree
  serviceType?: string;     // e.g. "INPATIENT", "OUTPATIENT"
}

/**
 * Call Claude via Bedrock to synthesize multiple regional LCD variants into
 * one authoritative criteria decision tree — the "strictest superset".
 */
async function synthesizeTrees(sources: CriteriaTreeResult[]): Promise<CriteriaTreeResult | null> {
  if (sources.length === 0) return null;
  if (sources.length === 1) return sources[0]!;   // nothing to synthesize

  try {
    const { BedrockRuntimeClient, ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

    const sourceSummaries = sources
      .slice(0, 8)  // cap at 8 sources to keep prompt manageable
      .map((s, i) => {
        const treeJson = JSON.stringify(s.tree, null, 2).slice(0, 1800);
        return `Source ${i + 1}: ${s.policy.title} (${s.policy.cmsId ?? s.policy.policyType})\nScope: ${s.criteriaSet.scopeSetting} / ${s.criteriaSet.scopeRequestType}\nTree:\n${treeJson}`;
      })
      .join('\n\n---\n\n');

    const sharedTitle = sources[0]!.policy.title
      .replace(/\s*\(.*?\)\s*/g, '')  // strip parentheticals
      .replace(/\s*-\s*(TPI|TPA|LCD.*|NCD.*)$/i, '')
      .trim();

    const prompt = `You are a clinical coverage criteria expert. The following are ${sources.length} regional Medicare LCD policies that cover the same procedure from different contractors. Synthesize them into ONE authoritative criteria decision tree.

SHARED CONCEPT: "${sharedTitle}"
SCOPE: ${sources[0]!.criteriaSet.scopeSetting} / ${sources[0]!.criteriaSet.scopeRequestType}

SOURCE POLICIES:
${sourceSummaries}

INSTRUCTIONS:
1. Create ONE unified criteria decision tree using the STRICTEST SUPERSET approach — if ANY source requires a criterion, include it
2. Resolve conflicts by using the more specific/stringent threshold
3. Preserve all LOINC codes, ICD-10 codes, and numeric thresholds from the sources
4. Use proper AND/OR/LEAF node types — AND means ALL must be met, OR means ANY one suffices
5. The root node label should be the shared concept name (not a specific LCD number)
6. Keep the tree clinically actionable — 5–12 LEAF nodes maximum

Return ONLY valid JSON matching this exact TypeScript interface (no markdown, no explanation):
interface TreeNode {
  id: string;
  label: string;
  description?: string;
  type: "AND" | "OR" | "LEAF";
  dataType?: "vital" | "lab" | "diagnosis" | "procedure" | "coverage" | "clinical_note";
  threshold?: { operator: string; value?: number | string | string[]; unit?: string; loinc?: string; display?: string };
  required: boolean;
  clinicalNotes?: string;
  children?: TreeNode[];
}`;

    const response = await client.send(new ConverseCommand({
      modelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6',
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 8000, temperature: 0.1 },
    }));

    const text = response.output?.message?.content?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const synthesizedTree = JSON.parse(jsonMatch[0]) as TreeNode;
    const sourceIds = sources.map(s => s.policy.cmsId ?? s.policy.id).filter(Boolean);

    return {
      relevanceScore: 150,   // always ranked first
      isPrimary: true,
      policy: {
        id: `synthesized-${Date.now()}`,
        title: `${sharedTitle} — Synthesized Criteria`,
        policyType: 'SYNTHESIZED',
        cmsId: null,
        sourceUrl: null,
        // @ts-expect-error — extra field for UI citation
        sourceIds,
        sourcePolicies: sources.slice(0, 8).map(s => ({ cmsId: s.policy.cmsId, title: s.policy.title })),
        sourcePolicyCount: sources.length,
      },
      criteriaSet: {
        id: `synthesized-cs-${Date.now()}`,
        criteriaSetId: `SYNTHESIZED-${sharedTitle.replace(/\s+/g, '-').toUpperCase().slice(0, 30)}`,
        title: `${sharedTitle} — Synthesized from ${sources.length} regional policies`,
        scopeSetting: sources[0]!.criteriaSet.scopeSetting,
        scopeRequestType: sources[0]!.criteriaSet.scopeRequestType,
        cqlLibraryFhirId: null,
        procedureCodes: null,
      },
      tree: synthesizedTree,
      matchedOn: sources[0]!.matchedOn,
    };
  } catch (err) {
    console.error('Synthesis error:', err instanceof Error ? err.message : err);
    return null;
  }
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

  // Single JOIN query: fetch policies + criteria_sets together to avoid N+1 queries.
  // ICD-10 matching is still done in JS for flexible prefix/substring logic.
  const rows = await db('policies as p')
    .join('criteria_sets as cs', 'cs.policy_id', 'p.id')
    .where('p.status', 'ACTIVE')
    .where('cs.status', 'ACTIVE')
    .modify((qb) => {
      if (query.serviceType) {
        qb.where('cs.scope_setting', query.serviceType.toUpperCase());
      }
    })
    .select(
      'p.id as policy_id', 'p.title as policy_title', 'p.policy_type',
      'p.cms_id', 'p.source_url', 'p.sections_json',
      'cs.id as cs_id', 'cs.criteria_set_id', 'cs.title as cs_title',
      'cs.scope_setting', 'cs.scope_request_type',
      'cs.cql_library_fhir_id', 'cs.dsl_json', 'cs.procedure_codes',
    );

  const results: CriteriaTreeResult[] = [];

  for (const row of rows) {
    // Check if policy covers any of the input diagnosis codes
    let matches = false;
    let relevanceScore = 0;
    let isPrimary = false;

    if (inputCodes.length > 0) {
      const sections =
        typeof row.sections_json === 'string'
          ? JSON.parse(row.sections_json)
          : (row.sections_json ?? {});
      const policyCodes: string[] = (sections.diagnosisCodes ?? []).map((c: string) =>
        c.toUpperCase(),
      );

      for (const inputCode of inputCodes) {
        const idx = policyCodes.findIndex(
          (pc) => pc === inputCode || inputCode.startsWith(pc) || pc.startsWith(inputCode),
        );
        if (idx !== -1) {
          matches = true;
          // Position-based relevance: codes listed first are primary diagnoses
          // idx 0 = 100 pts, idx 1 = 90, idx 2 = 80, idx 3-5 = 50, idx 6+ = 20
          const posScore = idx === 0 ? 100 : idx === 1 ? 90 : idx === 2 ? 80 : idx <= 5 ? 50 : 20;
          // Exact match scores higher than prefix match
          const exactBonus = policyCodes[idx] === inputCode ? 10 : 0;
          relevanceScore = Math.max(relevanceScore, posScore + exactBonus);
          if (idx <= 2) isPrimary = true;
        }
      }
    }

    if (!matches && !query.cpt) continue;

    // If a CPT/HCPCS code was provided, skip criteria sets that have procedure_codes
    // defined but don't include this CPT — this gives the diagnosis+procedure precision
    if (query.cpt) {
      const pCodes: string[] = row.procedure_codes
        ? (typeof row.procedure_codes === 'string'
            ? JSON.parse(row.procedure_codes)
            : (row.procedure_codes as string[]))
        : [];
      const cptUpper = query.cpt.toUpperCase().trim();
      // If this criteria set has procedure codes and the CPT isn't in them — skip
      if (pCodes.length > 0 && !pCodes.some(p => p.toUpperCase() === cptUpper)) {
        continue;
      }
      // CPT match: big relevance boost — this IS the right criteria for the procedure
      if (pCodes.some(p => p.toUpperCase() === cptUpper)) {
        relevanceScore = Math.min(120, relevanceScore + 30);
        isPrimary = true;
      }
    }

    const dsl =
      typeof row.dsl_json === 'string'
        ? JSON.parse(row.dsl_json)
        : (row.dsl_json ?? {});

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
        label: row.cs_title,
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
      tree = buildFallbackTree(row.cs_title);
    }

    results.push({
      relevanceScore,
      isPrimary,
      policy: {
        id: row.policy_id,
        title: row.policy_title,
        policyType: row.policy_type,
        cmsId: row.cms_id ?? null,
        sourceUrl: row.source_url ?? null,
      },
      criteriaSet: {
        id: row.cs_id,
        criteriaSetId: row.criteria_set_id,
        title: row.cs_title,
        scopeSetting: row.scope_setting,
        scopeRequestType: row.scope_request_type,
        cqlLibraryFhirId: row.cql_library_fhir_id ?? null,
        procedureCodes: row.procedure_codes
          ? (typeof row.procedure_codes === 'string'
              ? JSON.parse(row.procedure_codes)
              : (row.procedure_codes as string[]))
          : null,
      },
      tree,
      matchedOn: { diagnosisCodes: inputCodes, serviceType: query.serviceType },
    });
  }

  // Sort by relevance score first
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Deduplicate regional MAC variants: multiple LCDs often represent the same
  // clinical policy published by different Medicare contractors.
  // Strategy: build a 3-word title fingerprint (lowercase, no stop-words,
  // no parentheticals) — if two results share the same fingerprint, keep only
  // the highest-scoring one (already first after sort above).
  const STOP_WORDS = new Set(['of','the','and','for','in','to','a','an','with','or','on','at','by','is','are','not','from','into','as','that','this','its','it']);

  function titleFingerprint(title: string): string {
    const cleaned = title
      .toLowerCase()
      .replace(/\([^)]*\)/g, '')   // strip parentheticals like (TPI), (LCD L35010)
      .replace(/[^a-z\s]/g, ' ')   // keep only letters and spaces
      .trim();
    const words = cleaned.split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      // Basic stemming: strip trailing 's' so injection/injections, point/points collapse
      .map(w => (w.endsWith('s') && w.length > 4) ? w.slice(0, -1) : w);
    return words.slice(0, 4).sort().join('|');
  }

  const seen = new Map<string, true>();
  const deduped: CriteriaTreeResult[] = [];
  for (const result of results) {
    const fp = titleFingerprint(result.policy.title);
    if (!seen.has(fp)) {
      seen.set(fp, true);
      deduped.push(result);
    }
  }

  // Optional LLM synthesis: when requested AND there are multiple primary results,
  // call Claude to merge them into one authoritative tree and prepend it.
  if (query.synthesize && deduped.length > 1) {
    const primarySources = deduped.filter(r => r.isPrimary);
    const toSynthesize = primarySources.length >= 2 ? primarySources : deduped;
    const synthesized = await synthesizeTrees(toSynthesize.slice(0, 8));
    if (synthesized) {
      return [synthesized, ...deduped];
    }
  }

  return deduped;
}
