#!/usr/bin/env node
/**
 * CMS NCD/LCD → Criteria Tree Generator
 *
 * Reads the CMS all_data.zip (nested zip structure), filters active covered NCDs,
 * calls Claude via Bedrock to generate structured criteria decision trees, and
 * inserts DRAFT records into the policies + criteria_sets tables.
 *
 * Usage:
 *   npx tsx scripts/generate-criteria-from-cms.ts
 *   npx tsx scripts/generate-criteria-from-cms.ts --limit 10
 *   npx tsx scripts/generate-criteria-from-cms.ts --ncd-id 20.4
 *   npx tsx scripts/generate-criteria-from-cms.ts --dry-run
 *   npx tsx scripts/generate-criteria-from-cms.ts --dry-run --limit 3
 *
 * Environment (passed directly or via packages/backend/.env):
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *   AWS_REGION, AWS_PROFILE, BEDROCK_MODEL_ID
 */

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Bootstrap: load .env from packages/backend if DB_PASSWORD not already set
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnvFile(envPath: string): void {
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    // Only set if key is absent OR currently empty — never overwrite a non-empty value
    if (key && !process.env[key]) {
      process.env[key] = val;
    }
  }
}

// Load backend .env / .env.test for DB creds if not already in environment.
// Priority: .env (production/local) → .env.test (test/CI) — never overwrites
// existing env vars so explicit CLI exports always win.
if (!process.env.DB_PASSWORD) {
  loadEnvFile(resolve(ROOT, 'packages/backend/.env'));
}
if (!process.env.DB_PASSWORD) {
  // Fallback: .env.test contains the same DB creds for the shared dev MySQL instance
  loadEnvFile(resolve(ROOT, 'packages/backend/.env.test'));
}
// When falling back to .env.test the DB_NAME will be lucidreview_test (the test DB).
// Override to 'lucidreview' (the main production/dev DB) so criteria land in the right place.
// The caller can still override with an explicit DB_NAME env var set before invoking the script.
if (process.env.DB_NAME === 'lucidreview_test') {
  process.env.DB_NAME = 'lucidreview';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZIP_PATH = '/tmp/cms-mcd/all_data.zip';
const EXTRACT_DIR = '/tmp/cms-mcd/extracted';
const CMS_DOWNLOAD_URL =
  'https://downloads.cms.gov/medicare-coverage-database/downloads/exports/all_data.zip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NcdRow {
  NCD_id: string;
  NCD_vrsn_num: string;
  NCD_mnl_sect: string;
  NCD_mnl_sect_title: string;
  NCD_efctv_dt: string;
  NCD_impltn_dt: string;
  NCD_trmntn_dt: string;
  cvrg_lvl_cd: string;
  itm_srvc_desc: string;
  indctn_lmtn: string;
  xref_txt: string;
  othr_txt: string;
  trnsmtl_num: string;
  trnsmtl_url: string;
  ncd_keyword: string;
  [key: string]: string;
}

interface CriteriaResult {
  dslJson: object;
  diagnosisCodes: string[];
  scopeSetting: 'INPATIENT' | 'OUTPATIENT' | 'DME' | 'HOME_HEALTH';
  scopeRequestType: 'ADMISSION' | 'CONTINUED_STAY' | 'PROCEDURE' | 'SERVICE' | 'MEDICATION' | 'DME';
  summary: string;
}

interface LcdRow {
  lcd_id: string;
  lcd_version: string;
  title: string;
  determination_number: string;
  orig_det_eff_date: string;
  ent_det_end_date: string;
  rev_eff_date: string;
  indication: string;
  coding_guidelines: string;
  doc_reqs: string;
  keywords: string;
  status: string;
  date_retired: string;
  [key: string]: string;
}

// ---------------------------------------------------------------------------
// Zip extraction via python3 (no adm-zip dependency needed)
// ---------------------------------------------------------------------------

async function ensureZip(): Promise<void> {
  if (!existsSync(ZIP_PATH)) {
    console.log(`Downloading CMS all_data.zip (~183MB) from CMS...`);
    mkdirSync('/tmp/cms-mcd', { recursive: true });
    execSync(`curl -sL "${CMS_DOWNLOAD_URL}" -o "${ZIP_PATH}"`, { stdio: 'inherit' });
    console.log('Download complete.');
  } else {
    console.log(`Using existing zip at ${ZIP_PATH}`);
  }
}

function extractNcdCsv(): string {
  mkdirSync(EXTRACT_DIR, { recursive: true });
  const csvPath = `${EXTRACT_DIR}/ncd_trkg.csv`;

  if (existsSync(csvPath)) {
    console.log(`Using cached CSV at ${csvPath}`);
    return csvPath;
  }

  const pyScript = `${EXTRACT_DIR}/extract_ncd.py`;
  writeFileSync(
    pyScript,
    `import zipfile, io
outer = zipfile.ZipFile('${ZIP_PATH}')
ncd_zip = zipfile.ZipFile(io.BytesIO(outer.read('ncd.zip')))
csv_zip = zipfile.ZipFile(io.BytesIO(ncd_zip.read('ncd_csv.zip')))
with open('${csvPath}', 'wb') as f:
    f.write(csv_zip.read('ncd_trkg.csv'))
print('ncd_trkg.csv extracted to ${csvPath}')
`,
  );

  console.log('Extracting ncd_trkg.csv from nested zips via python3...');
  execSync(`python3 ${pyScript}`, { stdio: 'inherit' });
  return csvPath;
}

// ---------------------------------------------------------------------------
// CSV parsing (manual — csv-parse not in dependencies)
// ---------------------------------------------------------------------------

/**
 * Minimal RFC-4180-compliant CSV parser that handles quoted fields containing
 * commas, newlines, and escaped double-quotes ("").
 */
function parseCsvManual(content: string): Record<string, string>[] {
  const result: Record<string, string>[] = [];

  // Tokenise the whole file character-by-character
  function parseRow(src: string, pos: number): { fields: string[]; next: number } {
    const fields: string[] = [];
    let i = pos;

    while (i <= src.length) {
      // End of input or bare \r\n / \n terminates a row
      if (i === src.length || src[i] === '\n' || (src[i] === '\r' && src[i + 1] === '\n')) {
        fields.push(''); // empty trailing field
        i = i === src.length ? i : src[i] === '\r' ? i + 2 : i + 1;
        break;
      }

      if (src[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = '';
        while (i < src.length) {
          if (src[i] === '"') {
            if (src[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += src[i++];
          }
        }
        fields.push(field);
        // skip separator or newline
        if (src[i] === ',') i++;
        else if (src[i] === '\r' && src[i + 1] === '\n') { i += 2; break; }
        else if (src[i] === '\n') { i++; break; }
        else if (i === src.length) break;
      } else {
        // Unquoted field — read until comma or newline
        let field = '';
        while (i < src.length && src[i] !== ',' && src[i] !== '\n' && src[i] !== '\r') {
          field += src[i++];
        }
        fields.push(field);
        if (src[i] === ',') i++;
        else if (src[i] === '\r' && src[i + 1] === '\n') { i += 2; break; }
        else if (src[i] === '\n') { i++; break; }
        else if (i === src.length) break;
      }
    }

    return { fields, next: i };
  }

  const src = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let pos = 0;

  // Parse header row
  const { fields: headers, next: afterHeader } = parseRow(src, 0);
  pos = afterHeader;

  // Parse data rows
  while (pos < src.length) {
    const { fields, next } = parseRow(src, pos);
    pos = next;

    // Skip completely blank lines
    if (fields.length === 0 || (fields.length === 1 && fields[0] === '')) continue;

    const row: Record<string, string> = {};
    for (let col = 0; col < headers.length; col++) {
      row[headers[col] ?? `col${col}`] = fields[col] ?? '';
    }
    result.push(row);
  }

  return result;
}

function parseNcdCsv(csvPath: string): NcdRow[] {
  const content = readFileSync(csvPath, 'utf-8');
  return parseCsvManual(content) as NcdRow[];
}

function filterActiveCoveredNcds(rows: NcdRow[]): NcdRow[] {
  return rows.filter(
    (r) =>
      !r.NCD_trmntn_dt?.trim() && // still active
      r.cvrg_lvl_cd?.trim() === '2' && // covered (not non-covered or contractor discretion)
      (r.indctn_lmtn?.trim() || r.itm_srvc_desc?.trim()), // has clinical text
  );
}

// ---------------------------------------------------------------------------
// HTML stripping
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Claude via Bedrock
// ---------------------------------------------------------------------------

const DSL_SCHEMA = `{
  "id": "string (unique node id, e.g. 'root' or 'dx-1')",
  "type": "AND" | "OR" | "LEAF",
  "label": "Human-readable criterion name",
  "description": "Optional clarifying detail",
  "required": true | false,
  "dataType": "vital" | "lab" | "diagnosis" | "procedure" | "coverage" | "clinical_note",
  "threshold": {
    "operator": ">" | "<" | ">=" | "<=" | "==" | "in",
    "value": <number | string | string[]>,
    "unit": "optional unit string",
    "loinc": "optional LOINC code",
    "display": "human-readable value label"
  },
  "cqlExpression": "optional CQL expression name",
  "clinicalNotes": "optional free-text note",
  "children": [ ...nested TreeNodes for AND/OR nodes ]
}`;

/**
 * Best-effort repair of a truncated JSON object from Claude.
 *
 * When max_tokens is hit mid-stream the JSON is cut off mid-string or mid-array.
 * Strategy: extract the top-level scalar fields we care about (diagnosisCodes,
 * scopeSetting, scopeRequestType, summary) using targeted regex, and attempt
 * to parse the dslJson sub-object separately.  Returns null if we cannot
 * extract at least scopeSetting and summary.
 */
function repairTruncatedJson(raw: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};

  // Extract scopeSetting
  const ssMatch = raw.match(/"scopeSetting"\s*:\s*"([A-Z_]+)"/);
  if (ssMatch) result['scopeSetting'] = ssMatch[1];

  // Extract scopeRequestType
  const srtMatch = raw.match(/"scopeRequestType"\s*:\s*"([A-Z_]+)"/);
  if (srtMatch) result['scopeRequestType'] = srtMatch[1];

  // Extract summary (may be truncated — take what we have)
  const sumMatch = raw.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)["\\]?/);
  if (sumMatch) result['summary'] = sumMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');

  // Extract diagnosisCodes array — grab whatever codes appear before truncation
  const dxMatch = raw.match(/"diagnosisCodes"\s*:\s*(\[[\s\S]*?(?:\]|(?="[a-z])|\n\n))/);
  if (dxMatch) {
    const arrText = dxMatch[1].replace(/,?\s*$/, '') + (dxMatch[1].trim().endsWith(']') ? '' : ']');
    try {
      result['diagnosisCodes'] = JSON.parse(arrText);
    } catch {
      // Extract individual codes with a simple regex
      const codes = [...raw.matchAll(/"([A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?)"(?=\s*[,\]])/g)].map(m => m[1]);
      if (codes.length > 0) result['diagnosisCodes'] = codes;
    }
  }

  // Attempt to extract dslJson — find the opening brace after "dslJson":
  const dslStart = raw.indexOf('"dslJson"');
  if (dslStart !== -1) {
    const braceStart = raw.indexOf('{', dslStart + 9);
    if (braceStart !== -1) {
      // Walk forward balancing braces to find how far we got
      let depth = 0;
      let end = -1;
      for (let i = braceStart; i < raw.length; i++) {
        if (raw[i] === '{') depth++;
        else if (raw[i] === '}') {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      const dslRaw = end !== -1 ? raw.slice(braceStart, end + 1) : raw.slice(braceStart);
      try {
        result['dslJson'] = JSON.parse(dslRaw);
      } catch {
        // dslJson is truncated — build a minimal placeholder from what we can extract
        const labelMatch = raw.match(/"label"\s*:\s*"([^"]+)"/);
        result['dslJson'] = {
          id: 'root',
          type: 'AND',
          label: labelMatch?.[1] ?? 'Coverage Criteria',
          required: true,
          dataType: 'coverage',
          children: [],
          clinicalNotes: 'Criteria tree truncated — re-run to regenerate',
        };
      }
    }
  }

  // Return only if we have the minimum viable fields
  if (result['scopeSetting'] && result['summary']) return result;
  return null;
}

// Lazily initialised Bedrock client (shared across calls)
let _bedrockClient: InstanceType<typeof import('@aws-sdk/client-bedrock-runtime').BedrockRuntimeClient> | null = null;
let _ConverseCommand: typeof import('@aws-sdk/client-bedrock-runtime').ConverseCommand | null = null;

function getBedrockClient() {
  if (_bedrockClient && _ConverseCommand) {
    return { client: _bedrockClient, ConverseCommand: _ConverseCommand };
  }
  // Use createRequire so Node resolves the CJS build from backend node_modules
  const requireBackend = createRequire(
    resolve(ROOT, 'packages/backend/node_modules/@aws-sdk/client-bedrock-runtime/package.json'),
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bedrockMod = requireBackend('@aws-sdk/client-bedrock-runtime') as typeof import('@aws-sdk/client-bedrock-runtime');
  _ConverseCommand = bedrockMod.ConverseCommand;
  _bedrockClient = new bedrockMod.BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
  });
  return { client: _bedrockClient, ConverseCommand: _ConverseCommand };
}

/** Build the Claude prompt shared by both NCD and LCD generation. */
function buildClaudePrompt(
  policyLabel: string,
  cmsId: string,
  keywords: string,
  effectiveDate: string,
  clinicalText: string,
): string {
  return `You are a clinical coverage criteria expert. Convert this Medicare policy into a structured criteria decision tree for automated prior authorization review.

POLICY: ${policyLabel}
CMS ID: ${cmsId}
EFFECTIVE: ${effectiveDate || 'unknown'}
KEYWORDS: ${keywords}

POLICY TEXT:
${clinicalText}

Generate a JSON response with exactly these top-level fields:

1. "dslJson": A criteria decision tree following this schema:
${DSL_SCHEMA}

Rules for dslJson:
- Root node must have type "AND" with id "root" and label equal to the policy title
- Use "OR" nodes for alternative criteria (patient meets ANY of these)
- Use "LEAF" nodes for individual testable criteria items
- Include LOINC codes in threshold.loinc for labs/vitals when known
- For diagnosis LEAF nodes, put ICD-10 codes as an array in threshold.value with operator "in"
- dataType choices: "vital", "lab", "diagnosis", "procedure", "coverage", "clinical_note"
- Keep the tree clinically accurate, actionable, and complete
- At minimum include 3-8 LEAF nodes; cap the total tree at 20 LEAF nodes maximum
- If the policy lists many covered conditions, group related conditions under shared OR nodes rather than individual LEAFs

2. "diagnosisCodes": Array of ICD-10-CM codes (e.g. ["J96.00", "J96.01"]) that this policy applies to. Extract from policy text or infer from the condition name. Minimum 1, ideally 3-6.

3. "scopeSetting": Exactly one of "INPATIENT", "OUTPATIENT", "DME", "HOME_HEALTH" — based on the service type described.

4. "scopeRequestType": Exactly one of "ADMISSION", "CONTINUED_STAY", "PROCEDURE", "SERVICE", "MEDICATION", "DME"

5. "summary": 1-2 sentence plain English summary of when this service is covered under Medicare.

Respond with ONLY valid JSON. No explanation, no markdown code blocks, no surrounding text.`;
}

/** Call Bedrock with a prompt and parse the CriteriaResult JSON. */
async function callClaude(prompt: string): Promise<CriteriaResult | null> {
  const { client: bedrockClient, ConverseCommand } = getBedrockClient();
  try {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6',
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 16000, temperature: 0.1 },
      }),
    );

    const text: string = response.output?.message?.content?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`  Claude returned no JSON object. Raw (first 300):\n  ${text.slice(0, 300)}`);
      return null;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      const repaired = repairTruncatedJson(jsonMatch[0]);
      if (repaired) {
        console.warn(`  Warning: JSON truncated — partial repair (${Object.keys(repaired).join(', ')})`);
        parsed = repaired;
      } else {
        console.error(`  JSON parse error: ${parseErr instanceof Error ? parseErr.message : parseErr}`);
        console.error(`  Raw JSON snippet: ${jsonMatch[0].slice(0, 300)}`);
        return null;
      }
    }

    const validScopeSettings = ['INPATIENT', 'OUTPATIENT', 'DME', 'HOME_HEALTH'] as const;
    const validRequestTypes = ['ADMISSION', 'CONTINUED_STAY', 'PROCEDURE', 'SERVICE', 'MEDICATION', 'DME'] as const;

    const scopeSetting = validScopeSettings.includes(parsed.scopeSetting as typeof validScopeSettings[number])
      ? (parsed.scopeSetting as CriteriaResult['scopeSetting'])
      : 'OUTPATIENT';

    const scopeRequestType = validRequestTypes.includes(parsed.scopeRequestType as typeof validRequestTypes[number])
      ? (parsed.scopeRequestType as CriteriaResult['scopeRequestType'])
      : scopeSetting === 'INPATIENT' ? 'ADMISSION' : scopeSetting === 'DME' ? 'DME' : 'SERVICE';

    return {
      dslJson: (parsed.dslJson as object) ?? {},
      diagnosisCodes: Array.isArray(parsed.diagnosisCodes) ? (parsed.diagnosisCodes as string[]) : [],
      scopeSetting,
      scopeRequestType,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    };
  } catch (err) {
    console.error(`  Claude/Bedrock error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function generateCriteriaWithClaude(ncd: NcdRow): Promise<CriteriaResult | null> {
  const clinicalText = stripHtml(ncd.indctn_lmtn || ncd.itm_srvc_desc).slice(0, 4500);
  const prompt = buildClaudePrompt(
    `${ncd.NCD_mnl_sect_title} (NCD Section ${ncd.NCD_mnl_sect})`,
    ncd.NCD_mnl_sect,
    ncd.ncd_keyword ?? '',
    ncd.NCD_efctv_dt?.slice(0, 10) ?? '',
    clinicalText,
  );
  return callClaude(prompt);
}

// ---------------------------------------------------------------------------
// Database upsert
// ---------------------------------------------------------------------------

function getDb() {
  // Use createRequire to load CommonJS knex from backend node_modules
  const require = createRequire(
    resolve(ROOT, 'packages/backend/node_modules/knex/package.json'),
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const knex = require('knex') as typeof import('knex').default;

  return knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 13306),
      user: process.env.DB_USER ?? 'document_ai_admin',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'lucidreview',
      timezone: 'UTC',
    },
    pool: { min: 1, max: 3 },
  });
}

type DbInstance = ReturnType<typeof getDb>;

async function upsertNcdToDb(
  db: DbInstance,
  ncd: NcdRow,
  criteria: CriteriaResult,
): Promise<{ action: 'created' | 'updated' | 'skipped'; policyId: string }> {
  const cmsId = ncd.NCD_mnl_sect;

  const existing = await db('policies').where({ cms_id: cmsId }).first<{ id: string; status: string } | undefined>();

  const sectionsJson = {
    summary: criteria.summary,
    indications: stripHtml(ncd.indctn_lmtn).slice(0, 2000),
    diagnosisCodes: criteria.diagnosisCodes,
  };

  // Parse effective date safely — CMS format is "YYYY-MM-DD HH:MM:SS"
  let effectiveDate: string | null = null;
  if (ncd.NCD_efctv_dt?.trim()) {
    const parsed = new Date(ncd.NCD_efctv_dt.trim());
    if (!isNaN(parsed.getTime())) {
      effectiveDate = parsed.toISOString().slice(0, 10);
    }
  }

  const sourceUrl =
    ncd.trnsmtl_url?.trim() ||
    `https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=${ncd.NCD_id}`;

  let policyId: string;
  let action: 'created' | 'updated';

  if (existing) {
    policyId = existing.id;
    // Only overwrite DRAFT policies — never touch ACTIVE or RETIRED
    if (existing.status === 'DRAFT') {
      await db('policies').where({ id: policyId }).update({
        title: ncd.NCD_mnl_sect_title,
        sections_json: JSON.stringify(sectionsJson),
        effective_date: effectiveDate,
        updated_at: new Date(),
      });
      action = 'updated';
    } else {
      return { action: 'skipped', policyId };
    }
  } else {
    policyId = randomUUID();
    await db('policies').insert({
      id: policyId,
      policy_type: 'NCD',
      cms_id: cmsId,
      title: ncd.NCD_mnl_sect_title,
      status: 'DRAFT',
      effective_date: effectiveDate,
      source_url: sourceUrl,
      sections_json: JSON.stringify(sectionsJson),
      created_at: new Date(),
      updated_at: new Date(),
    });
    action = 'created';
  }

  // Upsert criteria_set
  const criteriaSetId = `NCD-${cmsId.replace(/\./g, '-')}-CRITERIA-v1`;
  const existingCs = await db('criteria_sets')
    .where({ criteria_set_id: criteriaSetId })
    .first<{ status: string } | undefined>();

  if (!existingCs) {
    await db('criteria_sets').insert({
      id: randomUUID(),
      criteria_set_id: criteriaSetId,
      policy_id: policyId,
      title: `${ncd.NCD_mnl_sect_title} — Coverage Criteria`,
      scope_setting: criteria.scopeSetting,
      scope_request_type: criteria.scopeRequestType,
      dsl_json: JSON.stringify(criteria.dslJson),
      status: 'DRAFT',
      created_at: new Date(),
      updated_at: new Date(),
    });
  } else if (existingCs.status === 'DRAFT') {
    await db('criteria_sets').where({ criteria_set_id: criteriaSetId }).update({
      dsl_json: JSON.stringify(criteria.dslJson),
      scope_setting: criteria.scopeSetting,
      scope_request_type: criteria.scopeRequestType,
      updated_at: new Date(),
    });
  }

  return { action, policyId };
}

// ---------------------------------------------------------------------------
// LCD support: extraction, parsing, Claude generation, DB upsert
// ---------------------------------------------------------------------------

function extractLcdCsv(): string {
  mkdirSync(EXTRACT_DIR, { recursive: true });
  const csvPath = `${EXTRACT_DIR}/lcd.csv`;

  if (existsSync(csvPath)) {
    console.log(`Using cached LCD CSV at ${csvPath}`);
    return csvPath;
  }

  const pyScript = `${EXTRACT_DIR}/extract_lcd.py`;
  writeFileSync(
    pyScript,
    `import zipfile, io, csv
csv.field_size_limit(10_000_000)
outer = zipfile.ZipFile('${ZIP_PATH}')
lcd_zip = zipfile.ZipFile(io.BytesIO(outer.read('current_lcd.zip')))
csv_zip = zipfile.ZipFile(io.BytesIO(lcd_zip.read('current_lcd_csv.zip')))
with open('${csvPath}', 'wb') as f:
    f.write(csv_zip.read('lcd.csv'))
print('lcd.csv extracted to ${csvPath}')
`,
  );

  console.log('Extracting lcd.csv from nested zips via python3...');
  execSync(`python3 ${pyScript}`, { stdio: 'inherit' });
  return csvPath;
}

function parseLcdCsv(csvPath: string): LcdRow[] {
  const content = readFileSync(csvPath, 'utf-8');
  return parseCsvManual(content) as LcdRow[];
}

function filterActiveLcds(rows: LcdRow[]): LcdRow[] {
  return rows.filter(
    (r) =>
      r.status?.trim() === 'A' &&          // active
      !r.date_retired?.trim() &&            // not retired
      (r.indication?.trim().length > 100),  // has clinical text
  );
}

async function generateCriteriaForLcd(lcd: LcdRow): Promise<CriteriaResult | null> {
  const indication  = stripHtml(lcd.indication ?? '').slice(0, 3000);
  const codingGuide = stripHtml(lcd.coding_guidelines ?? '').slice(0, 800);
  const docReqs     = stripHtml(lcd.doc_reqs ?? '').slice(0, 600);

  const combinedText = [indication, codingGuide, docReqs].filter(Boolean).join('\n\n');
  if (!combinedText.trim()) return null;

  const prompt = buildClaudePrompt(
    `${lcd.title} (LCD L${lcd.lcd_id})`,
    `L${lcd.lcd_id}`,
    lcd.keywords ?? '',
    lcd.rev_eff_date?.slice(0, 10) ?? lcd.orig_det_eff_date?.slice(0, 10) ?? '',
    combinedText,
  );

  return callClaude(prompt);
}

async function upsertLcdToDb(
  db: ReturnType<typeof getDb>,
  lcd: LcdRow,
  criteria: CriteriaResult,
): Promise<{ action: 'created' | 'updated' | 'skipped'; policyId: string }> {
  const cmsId = `L${lcd.lcd_id}`;
  const existing = await db('policies').where({ cms_id: cmsId }).first();

  const effectiveDate = (lcd.rev_eff_date || lcd.orig_det_eff_date)
    ? new Date(lcd.rev_eff_date || lcd.orig_det_eff_date).toISOString().slice(0, 10)
    : null;

  const sectionsJson = {
    summary: criteria.summary,
    indications: stripHtml(lcd.indication ?? '').slice(0, 2000),
    diagnosisCodes: criteria.diagnosisCodes,
  };

  let policyId: string;
  let action: 'created' | 'updated';

  if (existing) {
    policyId = existing.id as string;
    if ((existing.status as string) !== 'DRAFT') return { action: 'skipped', policyId };
    await db('policies').where({ id: policyId }).update({
      title: lcd.title,
      sections_json: JSON.stringify(sectionsJson),
      effective_date: effectiveDate,
      updated_at: new Date(),
    });
    action = 'updated';
  } else {
    policyId = randomUUID();
    await db('policies').insert({
      id: policyId,
      policy_type: 'LCD',
      cms_id: cmsId,
      title: lcd.title,
      status: 'DRAFT',
      effective_date: effectiveDate,
      source_url: `https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?LCDId=${lcd.lcd_id}`,
      sections_json: JSON.stringify(sectionsJson),
      created_at: new Date(),
      updated_at: new Date(),
    });
    action = 'created';
  }

  const criteriaSetId = `LCD-${lcd.lcd_id}-CRITERIA-v1`;
  const existingCs = await db('criteria_sets').where({ criteria_set_id: criteriaSetId }).first();

  if (!existingCs) {
    await db('criteria_sets').insert({
      id: randomUUID(),
      criteria_set_id: criteriaSetId,
      policy_id: policyId,
      title: `${lcd.title} — Coverage Criteria`,
      scope_setting: criteria.scopeSetting,
      scope_request_type: criteria.scopeRequestType,
      dsl_json: JSON.stringify(criteria.dslJson),
      status: 'DRAFT',
      created_at: new Date(),
      updated_at: new Date(),
    });
  } else if ((existingCs.status as string) === 'DRAFT') {
    await db('criteria_sets').where({ criteria_set_id: criteriaSetId }).update({
      dsl_json: JSON.stringify(criteria.dslJson),
      scope_setting: criteria.scopeSetting,
      updated_at: new Date(),
    });
  }

  return { action, policyId };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function processItems<T>(
  label: string,
  items: T[],
  generateFn: (item: T) => Promise<CriteriaResult | null>,
  upsertFn: ((db: ReturnType<typeof getDb>, item: T, criteria: CriteriaResult) => Promise<{ action: 'created' | 'updated' | 'skipped'; policyId: string }>) | null,
  idLabel: (item: T) => string,
  db: ReturnType<typeof getDb> | null,
  dryRun: boolean,
  cmsIdFn?: (item: T) => string,  // optional: returns cms_id to pre-check DB before calling Claude
): Promise<{ created: number; updated: number; skipped: number; errors: number }> {
  let created = 0, updated = 0, skipped = 0, errors = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const progress = `[${String(i + 1).padStart(String(items.length).length, ' ')}/${items.length}]`;

    // Pre-check: if a cms_id lookup function is provided and the DB already has
    // an ACTIVE policy with that cms_id, skip without calling Claude (saves API cost)
    if (!dryRun && db && cmsIdFn) {
      const cmsId = cmsIdFn(item);
      const existing = await (db as unknown as ReturnType<typeof getDb>)('policies')
        .where({ cms_id: cmsId, status: 'ACTIVE' }).first();
      if (existing) {
        console.log(`${progress} ${label} ${idLabel(item)}`);
        console.log(`         DB: skipped (already ACTIVE)\n`);
        skipped++;
        continue;
      }
    }

    console.log(`${progress} ${label} ${idLabel(item)}`);

    const criteria = await generateFn(item);

    if (!criteria) {
      console.log(`         FAILED: Claude generation returned null`);
      errors++;
    } else {
      const dslPreview = JSON.stringify(criteria.dslJson).slice(0, 120);
      console.log(`         scope: ${criteria.scopeSetting} / ${criteria.scopeRequestType}`);
      console.log(`         ICD-10: [${criteria.diagnosisCodes.slice(0, 6).join(', ')}${criteria.diagnosisCodes.length > 6 ? ', ...' : ''}]`);
      console.log(`         summary: ${criteria.summary.slice(0, 120)}`);
      console.log(`         dsl preview: ${dslPreview}${dslPreview.length >= 120 ? '...' : ''}`);

      if (!dryRun && db && upsertFn) {
        try {
          const result = await upsertFn(db, item, criteria);
          console.log(`         DB: ${result.action} (policy ${result.policyId})`);
          if (result.action === 'created') created++;
          else if (result.action === 'updated') updated++;
          else skipped++;
        } catch (dbErr) {
          console.error(`         DB error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
          errors++;
        }
      } else if (dryRun) {
        console.log(`         DB: (dry-run — skipped)`);
      }
    }
    console.log('');
    if (i < items.length - 1) await new Promise<void>((r) => setTimeout(r, 1000));
  }
  return { created, updated, skipped, errors };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const limitIdx    = args.indexOf('--limit');
  const limit       = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? '10', 10) : Infinity;
  const ncdIdIdx    = args.indexOf('--ncd-id');
  const targetNcdId = ncdIdIdx !== -1 ? args[ncdIdIdx + 1] : null;
  const lcdIdIdx    = args.indexOf('--lcd-id');
  const targetLcdId = lcdIdIdx !== -1 ? args[lcdIdIdx + 1] : null;
  const typeIdx     = args.indexOf('--type');
  const typeFilter  = (typeIdx !== -1 ? args[typeIdx + 1]?.toUpperCase() : null) ?? 'NCD';
  const dryRun      = args.includes('--dry-run');
  const runNcds     = typeFilter === 'NCD' || typeFilter === 'ALL';
  const runLcds     = typeFilter === 'LCD' || typeFilter === 'ALL';

  console.log('================================================================');
  console.log('CMS NCD/LCD Criteria Tree Generator');
  console.log('================================================================');
  console.log(`Mode      : ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
  console.log(`Type      : ${typeFilter}`);
  console.log(`Model     : ${process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6'}`);
  console.log(`Region    : ${process.env.AWS_REGION ?? 'us-east-1'}`);
  if (!dryRun) {
    console.log(`Database  : ${process.env.DB_USER ?? 'document_ai_admin'}@${process.env.DB_HOST ?? '127.0.0.1'}:${process.env.DB_PORT ?? 13306}/${process.env.DB_NAME ?? 'lucidreview'}`);
  }
  console.log('');

  await ensureZip();

  const db    = dryRun ? null : getDb();
  let created = 0, updated = 0, skipped = 0, errors = 0;

  // ── NCDs ──────────────────────────────────────────────────────────────────
  if (runNcds) {
    const csvPath = extractNcdCsv();
    console.log('\nParsing NCD CSV...');
    const allNcds = parseNcdCsv(csvPath);
    console.log(`  Total NCD rows     : ${allNcds.length}`);
    let ncds = filterActiveCoveredNcds(allNcds);
    console.log(`  Active covered NCDs: ${ncds.length}`);
    if (targetNcdId) { ncds = ncds.filter(r => r.NCD_mnl_sect === targetNcdId); console.log(`  After --ncd-id     : ${ncds.length}`); }
    if (limit !== Infinity) { ncds = ncds.slice(0, limit); console.log(`  After --limit      : ${ncds.length}`); }

    if (ncds.length > 0) {
      console.log(`\nProcessing ${ncds.length} NCDs...\n`);
      const r = await processItems('NCD', ncds, generateCriteriaWithClaude,
        (d, ncd, c) => upsertNcdToDb(d, ncd, c),
        n => `${n.NCD_mnl_sect} — ${n.NCD_mnl_sect_title}`,
        db, dryRun,
        n => n.NCD_mnl_sect);  // pre-check cms_id before calling Claude
      created += r.created; updated += r.updated; skipped += r.skipped; errors += r.errors;
    }
  }

  // ── LCDs ──────────────────────────────────────────────────────────────────
  if (runLcds) {
    const lcdCsvPath = extractLcdCsv();
    console.log('\nParsing LCD CSV...');
    const allLcds = parseLcdCsv(lcdCsvPath);
    console.log(`  Total LCD rows     : ${allLcds.length}`);
    let lcds = filterActiveLcds(allLcds);
    console.log(`  Active LCDs        : ${lcds.length}`);
    if (targetLcdId) { lcds = lcds.filter(r => r.lcd_id === targetLcdId); console.log(`  After --lcd-id     : ${lcds.length}`); }
    if (limit !== Infinity) { lcds = lcds.slice(0, limit); console.log(`  After --limit      : ${lcds.length}`); }

    if (lcds.length > 0) {
      console.log(`\nProcessing ${lcds.length} LCDs...\n`);
      const r = await processItems('LCD', lcds, generateCriteriaForLcd,
        (d, lcd, c) => upsertLcdToDb(d, lcd, c),
        l => `L${l.lcd_id} — ${l.title}`,
        db, dryRun,
        l => `L${l.lcd_id}`);  // pre-check cms_id before calling Claude
      created += r.created; updated += r.updated; skipped += r.skipped; errors += r.errors;
    }
  }

  if (db) await db.destroy();

  console.log('================================================================');
  console.log('Summary');
  console.log('================================================================');
  if (dryRun) {
    console.log('(DRY RUN — nothing written to database)');
  } else {
    console.log(`Created : ${created}`);
    console.log(`Updated : ${updated}`);
    console.log(`Skipped : ${skipped} (non-DRAFT policies not overwritten)`);
    console.log(`Errors  : ${errors}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
