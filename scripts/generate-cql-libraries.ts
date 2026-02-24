#!/usr/bin/env npx tsx
/**
 * generate-cql-libraries.ts
 *
 * Generates CQL Library resources for criteria_sets that have a cql_library_fhir_id
 * but no corresponding file in packages/backend/src/fhir/libraries/.
 *
 * Uses Bedrock (Claude) to generate CQL from the DSL criteria tree.
 *
 * Usage:
 *   DB_HOST=127.0.0.1 DB_PORT=13306 DB_USER=lucidreview DB_PASSWORD=... \
 *   node --import tsx/esm scripts/generate-cql-libraries.ts
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import knex from 'knex';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

// Find repo root by locating pnpm-workspace.yaml upward from this script
function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('Could not find repo root (pnpm-workspace.yaml not found)');
}

const SCRIPT_DIR = import.meta.dirname ?? new URL('.', import.meta.url).pathname;
const REPO_ROOT = findRepoRoot(SCRIPT_DIR);
const LIBRARIES_DIR = resolve(REPO_ROOT, 'packages/backend/src/fhir/libraries');

const EXAMPLE_CQL = readFileSync(
  join(LIBRARIES_DIR, 'UM-InpatientAdmission-AcuteRespFailure-v1.cql'),
  'utf-8',
);

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-2' });
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6';

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 13306),
    user: process.env.DB_USER ?? 'lucidreview',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'lucidreview',
  },
});

// ── Bedrock call ────────────────────────────────────────────────────────────
async function generateCQL(libraryId: string, title: string, dslJson: object): Promise<string> {
  const prompt = `You are a clinical informatics expert specializing in CQL (Clinical Quality Language) for FHIR R4.

Generate a CQL library for utilization management (UM) criteria evaluation.

## Library ID
${libraryId}

## Criteria Title
${title}

## DSL Criteria Tree (JSON)
The following JSON describes the clinical criteria tree. Each LEAF node has:
- \`dataType\`: "diagnosis" | "lab_value" | "clinical_note" | "vital_sign" | "procedure"
- \`threshold.value\`: ICD-10 codes (for diagnosis), numeric threshold, or string value
- \`threshold.operator\`: "in", ">=", "<=", "==", "<", ">"
- \`threshold.unit\`: unit if applicable
- \`cqlExpression\`: the name of the CQL define expression to create for this leaf
- \`label\`: human-readable description

\`\`\`json
${JSON.stringify(dslJson, null, 2)}
\`\`\`

## Example CQL Library (Acute Respiratory Failure)
Use this as your style and structure reference:
\`\`\`cql
${EXAMPLE_CQL}
\`\`\`

## Requirements
1. Start with: \`library ${libraryId.replace(/-/g, '_')} version '1.0.0'\`
2. Include FHIR R4 and FHIRHelpers declarations
3. Declare codesystems (ICD10CM, LOINC, SNOMEDCT as needed)
4. Define codes/valuesets for all ICD-10 and LOINC codes referenced in the DSL
5. Create a CQL \`define\` for every unique \`cqlExpression\` value in the DSL leaves
6. Create a top-level \`define "AdmissionCriteriaMet"\` that mirrors the AND/OR tree
7. Create individual top-level defines for each major criterion group (DiagnosisMet, etc.)
8. Use FHIR R4 resource types: [Condition], [Observation], [Procedure], [ServiceRequest]
9. Keep observations within clinically appropriate time windows (6-24 hours for acute, 30 days for chronic)
10. Return ONLY the raw CQL text, no markdown fences, no explanation.`;

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.content[0].text.trim();
}

// ── Build FHIR Library JSON ─────────────────────────────────────────────────
function buildLibraryJson(
  libraryId: string,
  title: string,
  cqlText: string,
  dslJson: object,
): object {
  // Extract unique ICD-10 and LOINC codes from DSL for dataRequirement
  const icd10Codes: string[] = [];
  const loincCodes: string[] = [];

  function extractCodes(node: any) {
    if (!node) return;
    if (node.threshold?.value && Array.isArray(node.threshold.value)) {
      node.threshold.value.forEach((v: string) => {
        if (/^[A-Z]\d+/.test(v)) icd10Codes.push(v);
        else if (/^\d{5}-\d$/.test(v)) loincCodes.push(v);
      });
    }
    (node.children ?? []).forEach(extractCodes);
  }
  extractCodes(dslJson);

  const dataRequirement: object[] = [];
  if (icd10Codes.length > 0) {
    dataRequirement.push({
      type: 'Condition',
      codeFilter: [{
        path: 'code',
        code: [...new Set(icd10Codes)].map(c => ({
          system: 'http://hl7.org/fhir/sid/icd-10-cm',
          code: c,
        })),
      }],
    });
  }
  if (loincCodes.length > 0) {
    const uniqueLoinc = [...new Set(loincCodes)];
    uniqueLoinc.forEach(code => {
      dataRequirement.push({
        type: 'Observation',
        codeFilter: [{
          path: 'code',
          code: [{ system: 'http://loinc.org', code }],
        }],
      });
    });
  }

  // Extract all top-level defines from CQL for parameters
  const defineNames = [...cqlText.matchAll(/^define "([^"]+)":/gm)].map(m => m[1]);
  const booleanDefines = defineNames.filter(n =>
    n !== 'Measurement Period' && !n.startsWith('Has ') || n.startsWith('Has ')
  );

  return {
    resourceType: 'Library',
    id: libraryId,
    url: `http://lucidreview.dev/Library/${libraryId}`,
    name: libraryId,
    title,
    version: '1.0.0',
    status: 'active',
    experimental: false,
    type: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/library-type',
        code: 'logic-library',
        display: 'Logic Library',
      }],
    },
    description: `CQL library evaluating inpatient admission criteria for: ${title}`,
    purpose: 'Utilization management criteria evaluation for prior authorization of inpatient admissions.',
    relatedArtifact: [{
      type: 'depends-on',
      display: 'FHIR Helpers',
      resource: 'http://fhir.org/guides/cqf/common/Library/FHIRHelpers|4.0.1',
    }],
    parameter: [
      { name: 'Measurement Period', use: 'in', min: 0, max: '1', type: 'Period' },
      { name: 'Patient', use: 'out', min: 0, max: '1', type: 'Patient' },
      ...defineNames.map(name => ({
        name,
        use: 'out',
        min: 0,
        max: '1',
        type: 'boolean',
      })),
    ],
    dataRequirement,
    content: [{
      contentType: 'text/cql',
      data: Buffer.from(cqlText).toString('base64'),
    }],
  };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // Find existing library file IDs
  const existingFiles = new Set(
    readdirSync(LIBRARIES_DIR)
      .filter(f => f.endsWith('.Library.json'))
      .map(f => f.replace('.Library.json', ''))
  );

  // Fetch all criteria_sets with a cql_library_fhir_id
  const rows = await db('criteria_sets as cs')
    .join('policies as p', 'cs.policy_id', 'p.id')
    .whereNotNull('cs.cql_library_fhir_id')
    .select('cs.cql_library_fhir_id', 'cs.title', 'cs.dsl_json', 'p.title as policy_title');

  // Filter to only those missing files
  const missing = rows.filter(r => {
    // Normalize: the DB might have old underscore IDs — normalise to hyphens
    const normalizedId = r.cql_library_fhir_id.replace(/_/g, '-');
    return !existingFiles.has(normalizedId) && !existingFiles.has(`UM-${normalizedId}`);
  });

  console.log(`Found ${rows.length} criteria sets with CQL library IDs.`);
  console.log(`${existingFiles.size} already exist. Generating ${missing.length} missing libraries.\n`);

  let success = 0;
  let failed = 0;

  for (const row of missing) {
    const libraryId = row.cql_library_fhir_id.replace(/_/g, '-');
    console.log(`\n[${missing.indexOf(row) + 1}/${missing.length}] Generating: ${libraryId}`);
    console.log(`  Title: ${row.title}`);

    try {
      const dsl = typeof row.dsl_json === 'string' ? JSON.parse(row.dsl_json) : row.dsl_json;

      const cqlText = await generateCQL(libraryId, row.title, dsl);
      console.log(`  ✅ CQL generated (${cqlText.split('\n').length} lines)`);

      const libraryJson = buildLibraryJson(libraryId, row.title, cqlText, dsl);

      // Write .cql file
      const cqlPath = join(LIBRARIES_DIR, `${libraryId}.cql`);
      writeFileSync(cqlPath, cqlText);
      console.log(`  📄 Written: ${libraryId}.cql`);

      // Write .Library.json file
      const jsonPath = join(LIBRARIES_DIR, `${libraryId}.Library.json`);
      writeFileSync(jsonPath, JSON.stringify(libraryJson, null, 2));
      console.log(`  📄 Written: ${libraryId}.Library.json`);

      success++;

      // Small delay between Bedrock calls to avoid throttling
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  ❌ Failed: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Generation complete: ${success} succeeded, ${failed} failed.`);
  console.log(`\nNext step: upload all libraries with:`);
  console.log(`  HAPI_FHIR_URL=http://localhost:18080/fhir pnpm upload:cql`);

  await db.destroy();
}

main().catch(err => { console.error(err); process.exit(1); });
