#!/usr/bin/env bash
# Build and push the reviewer-ui image.
# Uses a two-step process for Apple Silicon: native Vite build + amd64 nginx image.
# esbuild crashes under QEMU amd64 emulation, so we build JS natively first.
source "$(dirname "$0")/config.sh"

echo "Building reviewer-ui (native JS build + amd64 nginx)..."

# Step 1: Build JS/CSS natively on the host
cd "${REPO_ROOT}"
VITE_API_URL="${DOMAIN}" pnpm --filter @lucidreview/shared build
VITE_API_URL="${DOMAIN}" pnpm --filter @lucidreview/reviewer-ui build

# Step 2: Fix permissions (macOS can produce 600 files from public/)
chmod -R a+rX "${REPO_ROOT}/packages/reviewer-ui/dist/"

# Step 3: Package into nginx:alpine for linux/amd64
docker build \
  --platform "${PLATFORM}" \
  --push \
  -t "${ECR_REVIEWER_UI}:latest" \
  -f "${REPO_ROOT}/packages/reviewer-ui/Dockerfile.amd64" \
  "${REPO_ROOT}/packages/reviewer-ui/"

echo "Reviewer UI pushed to ${ECR_REVIEWER_UI}:latest"
