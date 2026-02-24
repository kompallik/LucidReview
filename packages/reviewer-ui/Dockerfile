# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-slim AS build

# VITE_API_URL is baked into the JS bundle at build time.
# Pass the production domain at build time:
#   docker build --build-arg VITE_API_URL=https://lucidreview.mhkdevsandbox.com ...
ARG VITE_API_URL=https://lucidreview.mhkdevsandbox.com
ENV VITE_API_URL=${VITE_API_URL}

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root configs
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# Copy only the package.json files needed for install
COPY packages/shared/package.json packages/shared/package.json
COPY packages/reviewer-ui/package.json packages/reviewer-ui/package.json

# Install dependencies (production + dev for build tooling)
RUN pnpm install --frozen-lockfile

# Copy shared source (needed for workspace link resolution)
COPY packages/shared/ packages/shared/

# Copy reviewer-ui source
COPY packages/reviewer-ui/ packages/reviewer-ui/

# Build shared first, then reviewer-ui
RUN pnpm --filter @lucidreview/shared build && \
    pnpm --filter @lucidreview/reviewer-ui build

# ─── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY packages/reviewer-ui/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/packages/reviewer-ui/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
