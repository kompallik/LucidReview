import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { config } from './config.js';

// Adapters
import { UmRestClient } from './adapters/um-rest-client.js';
import { MockUmAdapter } from './adapters/mock-um-adapter.js';
import { HapiFhirClient } from './adapters/hapi-fhir-client.js';
import { CtakesClient } from './adapters/ctakes-client.js';

// FHIR mapping
import { DefaultUmToFhirAdapter } from './mapping/um-to-fhir-adapter.js';

// UM system tools (7)
import { registerGetCase } from './tools/um-system/get-case.js';
import { registerGetClinicalInfo } from './tools/um-system/get-clinical-info.js';
import { registerGetAttachments } from './tools/um-system/get-attachments.js';
import { registerDownloadAttachment } from './tools/um-system/download-attachment.js';
import { registerGetCaseHistory } from './tools/um-system/get-case-history.js';
import { registerGetCaseNotes } from './tools/um-system/get-case-notes.js';
import { registerGetMemberCoverage } from './tools/um-system/get-member-coverage.js';

// PDF tool (1)
import { registerExtractText } from './tools/pdf/extract-text.js';

// NLP tool (1)
import { registerExtractEntities } from './tools/nlp/extract-entities.js';

// FHIR tools (2)
import { registerNormalizeCase } from './tools/fhir/normalize-case.js';
import { registerGetPatientSummary } from './tools/fhir/get-patient-summary.js';

// Criteria tools (3)
import { registerEvaluateCql } from './tools/criteria/evaluate-cql.js';
import { registerPolicyLookup } from './tools/criteria/policy-lookup.js';
import { registerProposeDetermination } from './tools/criteria/propose-determination.js';

// --- Determine which UM client to use ---
function isMockMode(): boolean {
  const baseUrl = config.umSystem.baseUrl;
  return !baseUrl || baseUrl.startsWith('http://mock');
}

const umClient = isMockMode() ? new MockUmAdapter() : new UmRestClient();
const fhirClient = new HapiFhirClient();
const ctakesClient = new CtakesClient();
const fhirAdapter = new DefaultUmToFhirAdapter();

// --- Create MCP Server ---
const server = new McpServer({
  name: 'lucidreview-mcp',
  version: '1.0.0',
});

// --- Register all 14 tools ---

// Category A: UM System Data (7 tools)
registerGetCase(server, umClient);
registerGetClinicalInfo(server, umClient);
registerGetAttachments(server, umClient);
registerDownloadAttachment(server, umClient);
registerGetCaseHistory(server, umClient);
registerGetCaseNotes(server, umClient);
registerGetMemberCoverage(server, umClient);

// Category B: PDF Processing (1 tool)
registerExtractText(server);

// Category C: NLP (1 tool)
registerExtractEntities(server, ctakesClient);

// Category D: FHIR Normalization (2 tools)
registerNormalizeCase(server, fhirClient, fhirAdapter);
registerGetPatientSummary(server, fhirClient);

// Category E: CQL & Policy (3 tools)
registerEvaluateCql(server, fhirClient);
registerPolicyLookup(server);
registerProposeDetermination(server);

// --- Connect transport and start ---
const transport = new StdioServerTransport();
await server.connect(transport);

// Log to stderr (stdout is reserved for MCP protocol)
console.error(
  `[lucidreview-mcp] Server started (mode: ${isMockMode() ? 'mock' : 'live'})`,
);

// --- Graceful shutdown ---
function shutdown() {
  console.error('[lucidreview-mcp] Shutting down...');
  server.close().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
