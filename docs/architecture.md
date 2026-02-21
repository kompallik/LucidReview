# Architecture Decision Records

## ADR-001: MCP (Model Context Protocol) over Direct Tool Calls

**Status:** Accepted

**Context:**
The LucidReview agent needs to call 14 tools (UM system REST APIs, PDF extraction, NLP, FHIR normalization, CQL evaluation, policy lookup, determination proposal). We needed to decide how to expose these tools to the Claude agent running via AWS Bedrock.

**Options considered:**
1. **Direct function calls** — Hard-code tool implementations inside the agent runner, translate manually to Bedrock `toolConfig`.
2. **MCP server via stdio** — Implement tools as an MCP server, spawn it as a child process, use the MCP SDK client to discover and invoke tools.
3. **MCP server via HTTP/SSE** — Same as (2) but over network transport.

**Decision:** Option 2 — MCP server as a stdio child process.

**Rationale:**
- **Schema-driven tool discovery**: `mcpClient.listTools()` returns JSON Schema for every tool. The agent runner translates these to Bedrock `toolConfig` automatically via `tool-translator.ts`. Adding a new tool means adding it to the MCP server; the agent runner picks it up with zero changes.
- **Clean separation of concerns**: The MCP server owns all external integrations (UM system, HAPI FHIR, cTAKES, PDF parsing). The agent runner owns only the Bedrock conversation loop and persistence. Neither knows about the other's internals.
- **Stdio transport is fast**: No network overhead, no port management, no service discovery. The MCP server is a child process — starts in milliseconds, communicates over stdin/stdout with JSON-RPC. Latency is negligible compared to LLM and external API calls.
- **Testability**: The MCP server can be tested independently (spawn it, send JSON-RPC, verify responses). The agent runner can be tested with a mock MCP server. Integration tests cover the full stdio round-trip.
- **Future flexibility**: MCP is an open standard. The same server could be used by other MCP clients (Claude Desktop, other agents) without modification.

**Consequences:**
- Both `packages/backend` and `packages/mcp-server` are built into the same Docker image (the backend spawns the MCP server binary).
- Debugging requires tracing through stdio pipes (mitigated by logging all tool calls to MySQL).
- The MCP SDK adds a dependency, but it's lightweight (~50KB).

---

## ADR-002: Internal HAPI FHIR Server for CQL Evaluation

**Status:** Accepted

**Context:**
LucidReview needs to evaluate clinical criteria (e.g., "SpO2 < 90% within 6 hours") against patient data. Criteria are authored in CQL (Clinical Quality Language), which requires a FHIR-based evaluation engine. The source data comes from a proprietary UM system, not from a FHIR server.

**Options considered:**
1. **Evaluate CQL in-process** — Use a JavaScript CQL engine (cql-execution) directly in Node.js.
2. **Internal HAPI FHIR with Clinical Reasoning** — Run HAPI FHIR as a Docker container, normalize UM data to FHIR, upload CQL Libraries, call `Library/$evaluate`.
3. **External FHIR server** — Connect to a hospital's existing FHIR endpoint.

**Decision:** Option 2 — Internal HAPI FHIR with Clinical Reasoning module.

**Rationale:**
- **Full CQL support**: HAPI FHIR's Clinical Reasoning module provides production-grade CQL evaluation with proper FHIR data access, terminology support, and expression caching. The JavaScript cql-execution library has limited FHIR integration and no R4 retrieve support out of the box.
- **FHIR as canonical data model**: Normalizing UM system data to FHIR R4 (Patient, Condition, Observation, etc.) before evaluation creates a clean, standards-based intermediate representation. This makes criteria portable across different UM system backends — swap the adapter, keep the CQL.
- **Audit trail**: Every piece of clinical data used in a determination is stored as a FHIR resource with provenance. The `GuidanceResponse` from CQL evaluation is itself a FHIR resource, creating a complete evidence chain.
- **No external dependency**: The FHIR server is internal-only (not exposed outside Docker). We don't depend on hospital FHIR endpoints, which vary in availability, version, and data completeness.
- **NLP integration**: NLP-extracted entities (from cTAKES/medspaCy) are mapped to FHIR resources with `Provenance` records marking them as NLP-derived. CQL queries can then operate uniformly over structured and NLP-derived data.

**Consequences:**
- Adds a JVM-based container (HAPI FHIR) to the stack — ~500MB memory, ~90s startup time.
- Requires a FHIR mapping adapter (`um-to-fhir-adapter.ts`) for each UM system integration.
- HAPI FHIR uses the same MySQL instance (separate `hapi_fhir` database), adding load to the DB.
- The FHIR normalization step adds latency to each agent run (~500ms for bundle POST).

---

## ADR-003: AWS Bedrock over Direct Anthropic API

**Status:** Accepted

**Context:**
LucidReview uses Claude (Sonnet) as the LLM agent brain. We needed to decide how to call the model: directly via the Anthropic API or via AWS Bedrock.

**Options considered:**
1. **Anthropic API directly** — Use the `@anthropic-ai/sdk` with an API key.
2. **AWS Bedrock Converse API** — Use `@aws-sdk/client-bedrock-runtime` with IAM credentials.

**Decision:** Option 2 — AWS Bedrock Converse API.

**Rationale:**
- **No API key management**: In production (ECS), the task role provides credentials automatically. No API keys to rotate, store in secrets managers, or risk leaking. Local development uses `~/.aws` credentials (same as all other AWS tooling).
- **Unified billing**: LLM costs appear on the same AWS bill as infrastructure (ECS, RDS, etc.). No separate Anthropic billing relationship to manage. Usage is tracked per-account with CloudWatch metrics.
- **VPC integration**: Bedrock calls stay within the AWS network when running in ECS. No egress to external APIs, which simplifies network security policies and reduces latency.
- **Converse API compatibility**: The Bedrock Converse API uses a tool-calling format that maps cleanly to MCP tool schemas. `tool-translator.ts` performs a straightforward 1:1 translation from MCP `inputSchema` to Bedrock `toolSpec.inputSchema.json`.
- **Model flexibility**: Bedrock provides access to multiple Claude models (Haiku for fast/cheap, Sonnet for balanced, Opus for complex). Switching models is a config change (`BEDROCK_MODEL_ID`), not a code change.
- **Compliance**: Healthcare workloads benefit from AWS BAA (Business Associate Agreement) coverage. Bedrock is HIPAA-eligible when used within a BAA-covered account.

**Consequences:**
- Requires AWS credentials for local development (developers need AWS access configured).
- Bedrock model availability may lag behind Anthropic API releases by days/weeks.
- The Converse API has slightly different message formatting than the Anthropic Messages API (handled by the agent runner).
- Rate limits are per-account rather than per-API-key (managed via AWS Service Quotas).
