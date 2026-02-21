# ---- Stage 1: Build ----
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace root configs
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# Copy all package.json files for dependency resolution
COPY packages/shared/package.json packages/shared/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY packages/backend/package.json packages/backend/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy all source
COPY packages/shared/ packages/shared/
COPY packages/mcp-server/ packages/mcp-server/
COPY packages/backend/ packages/backend/

# Build in dependency order: shared → mcp-server → backend
RUN pnpm --filter @lucidreview/shared build && \
    pnpm --filter @lucidreview/mcp-server build && \
    pnpm --filter @lucidreview/backend build

# ---- Stage 2: Runtime ----
FROM node:22-slim AS runtime

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace root configs for pnpm resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy built packages (dist + package.json)
COPY packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist

COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY --from=builder /app/packages/mcp-server/dist packages/mcp-server/dist

COPY packages/backend/package.json packages/backend/package.json
COPY --from=builder /app/packages/backend/dist packages/backend/dist

# Copy FHIR assets needed at runtime (CQL libraries, bundles)
COPY --from=builder /app/packages/backend/src/fhir packages/backend/src/fhir

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "packages/backend/dist/index.js"]
