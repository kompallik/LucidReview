#!/usr/bin/env bash
# Build and push the backend image
source "$(dirname "$0")/config.sh"

echo "Building backend..."
docker build \
  --platform "${PLATFORM}" \
  --push \
  -t "${ECR_BACKEND}:latest" \
  -f "${REPO_ROOT}/packages/backend/Dockerfile" \
  "${REPO_ROOT}"

echo "Backend pushed to ${ECR_BACKEND}:latest"
