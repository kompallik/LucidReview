#!/usr/bin/env bash
# Build and push the cTAKES/medspacy NLP image
source "$(dirname "$0")/config.sh"

echo "Building ctakes..."
docker build \
  --platform "${PLATFORM}" \
  --push \
  -t "${ECR_CTAKES}:latest" \
  "${REPO_ROOT}/docker/ctakes/"

echo "cTAKES pushed to ${ECR_CTAKES}:latest"
