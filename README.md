# LucidReview

![Tests](https://img.shields.io/badge/unit_tests-218_passing-brightgreen) ![Packages](https://img.shields.io/badge/packages-4-blue) ![Build](https://img.shields.io/badge/build-passing-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

| Package | Unit Tests | Integration Tests |
|---|---|---|
| `@lucidreview/shared` | 51 | — |
| `@lucidreview/mcp-server` | 60 | — |
| `@lucidreview/backend` | 24 | 13 (requires Docker) |
| `@lucidreview/reviewer-ui` | 83 | — |
| **Total** | **218** | **13** |

LucidReview is an MCP-driven LLM agent for automating Utilization Management (UM) prior authorization reviews. A Claude agent running on AWS Bedrock orchestrates the review process by calling tools exposed through a Model Context Protocol (MCP) server. These tools fetch case data from an existing UM system via REST APIs, extract text from clinical PDFs, run NLP to identify clinical entities, normalize everything into FHIR R4 resources, evaluate CQL coverage criteria against a HAPI FHIR server, and propose structured determinations. A Reviewer UI lets nurse and MD reviewers monitor the agent's work, inspect evidence, and approve or override the determination.

## Architecture

```
┌──────────────┐     ┌──────────────────────────────────────────────┐
│              │     │            Fastify Backend (:3000)           │
│  Reviewer UI │────▶│                                              │
│  React SPA   │     │  ┌────────────────────────────────────────┐  │
│  (:5173)     │◀────│  │         Agent Runner                   │  │
│              │     │  │    (Bedrock Converse API loop)          │  │
└──────────────┘     │  │         │                               │  │
                     │  │         │ stdio                         │  │
                     │  │         ▼                               │  │
                     │  │  ┌─────────────────────────────────┐   │  │
                     │  │  │       MCP Server (child proc)   │   │  │
                     │  │  │                                 │   │  │
                     │  │  │  ┌───────┐ ┌──────┐ ┌───────┐  │   │  │
                     │  │  │  │UM REST│ │ PDF  │ │cTAKES │  │   │  │
                     │  │  │  │ Tools │ │Parse │ │  NLP  │  │   │  │
                     │  │  │  └───────┘ └──────┘ └───────┘  │   │  │
                     │  │  │  ┌───────┐ ┌──────┐ ┌───────┐  │   │  │
                     │  │  │  │ FHIR  │ │ CQL  │ │Policy │  │   │  │
                     │  │  │  │Normalize│Eval  │ │Lookup │  │   │  │
                     │  │  │  └───────┘ └──────┘ └───────┘  │   │  │
                     │  │  └─────────────────────────────────┘   │  │
                     │  └────────────────────────────────────────┘  │
                     └──────────────┬────────────┬─────────────────┘
                                    │            │
                     ┌──────────────▼──┐  ┌──────▼──────────┐
                     │  MySQL 8.0      │  │  HAPI FHIR R4   │
                     │  (:13306)       │  │  (:8080)         │
                     │  App state,     │  │  Clinical data,  │
                     │  agent runs,    │  │  CQL evaluation  │
                     │  policies       │  │                  │
                     └─────────────────┘  └─────────────────┘
                     ┌─────────────────┐  ┌─────────────────┐
                     │  Redis 7        │  │  cTAKES / NLP   │
                     │  (:6379)        │  │  (:8081)         │
                     │  Queue + cache  │  │  Entity extract  │
                     └─────────────────┘  └─────────────────┘
```

## Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0
- **Docker Desktop** (for MySQL, HAPI FHIR, Redis, cTAKES containers)
- **AWS credentials** with `bedrock:InvokeModel` permission (for Claude on Bedrock)

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url> LucidReview
cd LucidReview

# 2. Start infrastructure containers
docker compose up -d

# 3. Install all workspace dependencies
pnpm install

# 4. Build workspace packages (order matters — shared first)
pnpm --filter @lucidreview/shared build
pnpm --filter @lucidreview/mcp-server build

# 5. Load test data + CQL libraries into HAPI FHIR
pnpm setup

# 6. Start the backend (terminal 1)
pnpm --filter @lucidreview/backend dev

# 7. Start the Reviewer UI (terminal 2)
pnpm --filter @lucidreview/reviewer-ui dev
```

The backend API will be available at `http://localhost:3000` and the Reviewer UI at `http://localhost:5173`.

## Demo Walkthrough

### Via the Reviewer UI

1. Open `http://localhost:5173` in your browser
2. The Review Queue shows case **ARF-2026-001** (Acute Respiratory Failure, inpatient admission)
3. Click into the case detail, then click **"Run AI Review"**
4. Watch the Agent Trace Panel as the agent works through:
   - Fetching case data, clinical info, and member coverage
   - Downloading and extracting PDF attachments
   - Running NLP on clinical documents
   - Normalizing data to FHIR
   - Looking up applicable coverage policies
   - Evaluating CQL criteria
   - Proposing a determination
5. Review the criteria checklist (all MET for the happy path), evidence links, and rationale
6. Click **Approve** to finalize the determination

### Via curl

```bash
# Trigger an agent review run
curl -X POST http://localhost:3000/api/reviews/ARF-2026-001/agent-run

# Check run status (use the runId from the response above)
curl http://localhost:3000/api/agent-runs/<runId>

# View the full agent trace
curl http://localhost:3000/api/agent-runs/<runId>/trace
```

## Packages

| Package | Path | Description |
|---|---|---|
| `@lucidreview/shared` | `packages/shared` | TypeScript types, Zod validation schemas, FHIR constants, and utility functions shared across all packages |
| `@lucidreview/mcp-server` | `packages/mcp-server` | MCP server exposing 14 tools via stdio transport — UM data fetching, PDF extraction, NLP, FHIR normalization, CQL evaluation, and determination |
| `@lucidreview/backend` | `packages/backend` | Fastify API server with Agent Runner (Bedrock Converse loop + MCP client), database layer (Knex + MySQL), and REST endpoints for reviews, agent runs, and policies |
| `@lucidreview/reviewer-ui` | `packages/reviewer-ui` | React 19 SPA with Vite, Tailwind CSS, and TanStack Query — Review Queue, Case Detail with agent trace, criteria checklist, evidence viewer, and determination panel |

## MCP Tool Catalog

### Category A: UM System Data

| Tool | Input | Description |
|---|---|---|
| `um_get_case` | `{caseNumber}` | Fetch case metadata (patient, provider, facility, service type, dates, status) |
| `um_get_clinical_info` | `{caseNumber}` | Fetch clinical data (ICD-10 diagnoses, CPT codes, vitals, labs) |
| `um_get_attachments` | `{caseNumber}` | List attachments (fileName, mimeType, category) |
| `um_download_attachment` | `{caseNumber, attachmentId}` | Download attachment content (base64) |
| `um_get_case_history` | `{caseNumber}` | Fetch case action history |
| `um_get_case_notes` | `{caseNumber}` | Fetch case notes (clinical, administrative, reviewer) |
| `um_get_member_coverage` | `{memberId}` | Fetch plan info, benefits, coverage status |

### Category B: PDF Processing

| Tool | Input | Description |
|---|---|---|
| `pdf_extract_text` | `{base64Content}` | Extract text from PDF (pdf-parse, Textract fallback for scanned docs) |

### Category C: NLP

| Tool | Input | Description |
|---|---|---|
| `nlp_extract_clinical_entities` | `{text}` | Extract clinical entities with codes, assertions, and temporality |

### Category D: FHIR Normalization

| Tool | Input | Description |
|---|---|---|
| `fhir_normalize_case` | `{caseData, clinicalData, nlpEntities?}` | Map UM + NLP data to FHIR Bundle, POST to HAPI FHIR |
| `fhir_get_patient_summary` | `{patientId}` | Retrieve patient summary (conditions, observations, procedures, documents) |

### Category E: CQL & Policy

| Tool | Input | Description |
|---|---|---|
| `cql_evaluate_criteria` | `{libraryId, patientId}` | Evaluate CQL criteria library against patient data in HAPI FHIR |
| `policy_lookup` | `{diagnosisCodes[], serviceType}` | Find applicable coverage policies with criteria library IDs |
| `propose_determination` | `{caseNumber, criteriaResults[], policyBasis[]}` | Produce structured determination (deterministic logic, not LLM) |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `3000` | Backend server port |
| `DB_HOST` | `127.0.0.1` | MySQL host |
| `DB_PORT` | `13306` | MySQL port (matches RDS bastion convention) |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | `root_dev` | MySQL password |
| `DB_NAME` | `lucidreview` | MySQL database name |
| `HAPI_FHIR_URL` | `http://localhost:8080/fhir` | HAPI FHIR R4 server URL |
| `CTAKES_URL` | `http://localhost:8081` | cTAKES / NLP service URL |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `AWS_REGION` | `us-east-1` | AWS region for Bedrock |
| `AWS_PROFILE` | `default` | AWS CLI profile (local dev) |
| `BEDROCK_MODEL_ID` | `us.anthropic.claude-sonnet-4-6` | Bedrock model ID |
| `UM_SYSTEM_BASE_URL` | _(empty = mock)_ | UM system REST API base URL |
| `UM_SYSTEM_API_KEY` | _(empty)_ | UM system API key |
| `MCP_SERVER_PATH` | _(auto-detected)_ | Path to compiled MCP server entry |
| `VITE_API_URL` | `http://localhost:3000` | Backend URL for the Reviewer UI |

## Running Tests

### Unit Tests (no Docker needed)

```bash
# Run all 218 unit tests across all packages
pnpm test:unit

# Run tests for a specific package
pnpm --filter @lucidreview/shared test        # 51 tests
pnpm --filter @lucidreview/mcp-server test    # 60 tests
pnpm --filter @lucidreview/backend test       # 24 unit tests
pnpm --filter @lucidreview/reviewer-ui test   # 83 tests
```

### Integration Tests (Docker required)

Integration tests need MySQL and HAPI FHIR running via the test Docker Compose stack:

```bash
# Start the test infrastructure
docker compose -f docker-compose.test.yml up -d

# Run integration tests (13 tests covering all API routes)
pnpm test:integration

# Tear down when done
docker compose -f docker-compose.test.yml down -v
```

### Full E2E Demo

```bash
# Start all infrastructure + seed data
docker compose up -d
pnpm setup

# Run the automated demo (triggers agent run, polls, displays results)
pnpm demo
```

## Docker Containers

| Container | Image | Port | Purpose |
|---|---|---|---|
| `lucidreview-backend` | Custom (Node.js 22) | 3000 | Fastify API + Agent Runner (MCP server as child process) |
| `lucidreview-hapi-fhir` | `hapiproject/hapi:latest` | 8080 | Internal FHIR R4 store + Clinical Reasoning / CQL evaluation |
| `lucidreview-ctakes` | Custom (medspacy) | 8081 | Clinical NLP entity extraction |
| `lucidreview-mysql` | `mysql:8.0` | 13306 | Application state (agent runs, reviews, policies) |
| `lucidreview-redis` | `redis:7-alpine` | 6379 | Agent run queue + response caching |
| `lucidreview-ui` | Vite dev server | 5173 | Reviewer UI with HMR |
