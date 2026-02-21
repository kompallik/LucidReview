import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const PKG_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const DIST_INDEX = resolve(PKG_ROOT, 'dist', 'index.js');

const EXPECTED_TOOLS = [
  'um_get_case',
  'um_get_clinical_info',
  'um_get_attachments',
  'um_download_attachment',
  'um_get_case_history',
  'um_get_case_notes',
  'um_get_member_coverage',
  'pdf_extract_text',
  'nlp_extract_clinical_entities',
  'fhir_normalize_case',
  'fhir_get_patient_summary',
  'cql_evaluate_criteria',
  'policy_lookup',
  'propose_determination',
];

describe('MCP Server stdio round-trip', { timeout: 15_000 }, () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Build the server if dist doesn't exist
    if (!existsSync(DIST_INDEX)) {
      execSync('pnpm build', { cwd: PKG_ROOT, stdio: 'pipe' });
    }

    // Spawn MCP server as child process via stdio
    transport = new StdioClientTransport({
      command: 'node',
      args: [DIST_INDEX],
      env: {
        ...process.env as Record<string, string>,
        // Force mock mode
        UM_SYSTEM_BASE_URL: 'http://mock-um-system',
      },
      stderr: 'pipe',
    });

    client = new Client(
      { name: 'test-client', version: '1.0.0' },
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    try {
      await client?.close();
    } catch {
      // Ignore close errors during cleanup
    }
  });

  it('listTools returns all 14 expected tools', async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();

    expect(toolNames).toHaveLength(14);
    for (const expectedTool of EXPECTED_TOOLS) {
      expect(toolNames).toContain(expectedTool);
    }
  });

  it('um_get_case returns patient John for ARF-2026-001', async () => {
    const result = await client.callTool({
      name: 'um_get_case',
      arguments: { caseNumber: 'ARF-2026-001' },
    });

    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);

    const textContent = content[0];
    expect(textContent.type).toBe('text');
    const data = JSON.parse((textContent as { type: 'text'; text: string }).text);
    expect(data.patient.firstName).toBe('John');
    expect(data.patient.lastName).toBe('Doe');
    expect(data.caseNumber).toBe('ARF-2026-001');
  });

  it('propose_determination returns AUTO_APPROVE for all-MET criteria', async () => {
    const result = await client.callTool({
      name: 'propose_determination',
      arguments: {
        caseNumber: 'ARF-2026-001',
        criteriaResults: [
          { name: 'HasAcuteRespFailure', result: 'MET' },
          { name: 'RecentO2SatBelow90', result: 'MET' },
          { name: 'AdmissionCriteriaMet', result: 'MET' },
        ],
        policyBasis: [
          { policyId: 'POL-001', title: 'Acute Respiratory Failure' },
        ],
      },
    });

    const detContent = result.content as Array<{ type: string; text?: string }>;
    expect(detContent).toBeDefined();
    const textContent = detContent[0];
    expect(textContent.type).toBe('text');
    const data = JSON.parse((textContent as { type: 'text'; text: string }).text);
    expect(data.determination).toBe('AUTO_APPROVE');
    expect(data.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
