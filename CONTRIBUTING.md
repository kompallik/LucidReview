# Contributing to LucidReview

## Development Environment Setup

### Prerequisites

- Node.js >= 22
- pnpm >= 9
- Docker and Docker Compose
- AWS credentials configured (`~/.aws/credentials`) for Bedrock access

### Getting Started

```bash
# Clone and install
git clone <repo-url> && cd LucidReview
pnpm install

# Start infrastructure
docker compose up -d

# Wait for services to be healthy
pnpm health-check

# Run database migrations
pnpm migrate

# Seed FHIR server with test data + CQL libraries
pnpm setup

# Start development servers (backend + UI)
pnpm dev
```

The backend runs at `http://localhost:3000` and the UI at `http://localhost:5173`.

### Useful Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Start backend + UI in watch mode |
| `pnpm build` | Build all packages in dependency order |
| `pnpm test` | Run all tests |
| `pnpm test:unit` | Run unit tests only |
| `pnpm test:integration` | Run integration tests (requires docker-compose.test.yml) |
| `pnpm lint` | Lint all packages |
| `pnpm migrate` | Run database migrations |
| `pnpm setup` | Seed FHIR bundles + upload CQL libraries |
| `pnpm health-check` | Check all service connectivity |
| `pnpm demo` | Run automated E2E demo |

## Running Tests

```bash
# All tests
pnpm test

# Unit tests with verbose output
pnpm test:unit

# Integration tests (start test stack first)
docker compose -f docker-compose.test.yml up -d --wait
pnpm test:integration
docker compose -f docker-compose.test.yml down -v

# Single package
pnpm --filter @lucidreview/shared test
pnpm --filter @lucidreview/mcp-server test
pnpm --filter @lucidreview/backend test
pnpm --filter @lucidreview/reviewer-ui test
```

## Adding a New MCP Tool

MCP tools are the functions the AI agent can call during a review. Each tool lives in `packages/mcp-server/src/tools/`.

### Steps

1. **Create the tool file** in the appropriate category directory:
   ```
   packages/mcp-server/src/tools/<category>/<tool-name>.ts
   ```
   Categories: `um-system/`, `pdf/`, `nlp/`, `fhir/`, `criteria/`

2. **Implement the tool** following the existing pattern:
   ```typescript
   import { z } from 'zod';
   import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

   export function register<tool-name>(server: McpServer) {
     server.tool(
       'tool_name',
       'Description of what the tool does',
       {
         paramName: z.string().describe('Parameter description'),
       },
       async ({ paramName }) => {
         // Implementation
         return {
           content: [{ type: 'text', text: JSON.stringify(result) }],
         };
       },
     );
   }
   ```

3. **Register in index.ts** — Add the import and call the register function in `packages/mcp-server/src/index.ts`:
   ```typescript
   import { registerToolName } from './tools/<category>/<tool-name>.js';
   // ... inside createServer():
   registerToolName(server);
   ```

4. **Write tests** — Create a `.test.ts` file next to the tool, or in `__tests__/`.

5. **Update the system prompt** if the agent should use the tool in a specific workflow step. The system prompt is stored in the `prompt_versions` MySQL table and loaded by the agent runner.

The tool will be automatically discovered by the agent runner via `mcpClient.listTools()` and translated to Bedrock `toolConfig` format.

## Adding a New Policy

Policies define the clinical criteria for prior authorization decisions.

### Steps

1. **Create the policy record** via the API or directly in MySQL:
   ```bash
   # Via API (when backend is running)
   curl -X POST http://localhost:3000/api/policies -H 'Content-Type: application/json' -d '{
     "policyType": "INTERNAL",
     "title": "Your Policy Title",
     "status": "DRAFT",
     "sectionsJson": {
       "indications": "...",
       "limitations": "...",
       "documentation": "..."
     }
   }'
   ```

2. **Define criteria** — Create a criteria set linked to the policy with a DSL JSON describing the required facts, operators, and thresholds.

3. **Write the CQL library** — Create a `.cql` file in `packages/backend/src/fhir/libraries/` following the pattern of `UM-InpatientAdmission-AcuteRespFailure-v1.cql`.

4. **Create the FHIR Library resource** — Create a `.Library.json` file with the base64-encoded CQL content. Use `base64` to encode:
   ```bash
   base64 -i packages/backend/src/fhir/libraries/your-library.cql
   ```

5. **Upload to HAPI FHIR**:
   ```bash
   pnpm upload:cql
   ```

6. **Create test bundles** — Add FHIR R4 transaction bundles in `packages/backend/src/fhir/bundles/` for both positive (criteria met) and negative (criteria not met / missing data) test cases.

7. **Link criteria set to CQL** — Update the criteria set's `cql_library_fhir_id` to point to the FHIR Library resource ID.

8. **Test** — Run the agent against a test case and verify the CQL evaluation returns expected results.

## Project Structure

```
LucidReview/
├── packages/
│   ├── shared/          # Types, schemas, constants, utilities
│   ├── mcp-server/      # MCP tools (14 tools, stdio transport)
│   ├── backend/         # Fastify API + Agent Runner + Bedrock
│   └── reviewer-ui/     # React SPA (Vite + Tailwind + shadcn)
├── docker/              # Docker configs (HAPI FHIR, cTAKES, MySQL)
├── scripts/             # Setup, seed, health check, demo scripts
└── docs/                # Architecture ADRs, curl examples
```

## Code Style

- TypeScript strict mode, ESM modules
- Formatting: Prettier (auto-configured)
- Linting: ESLint with TypeScript rules
- Imports: Use `.js` extension for local imports (ESM resolution)
- Naming: camelCase for variables/functions, PascalCase for types/components
