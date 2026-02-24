#!/usr/bin/env bash
# Build and push the HAPI FHIR image (v7.6.0 + MySQL driver + application.yaml)
source "$(dirname "$0")/config.sh"

echo "Building hapi-fhir..."
docker build \
  --platform "${PLATFORM}" \
  --push \
  -t "${ECR_HAPI_FHIR}:latest" \
  "${REPO_ROOT}/docker/hapi-fhir/"

echo "HAPI FHIR pushed to ${ECR_HAPI_FHIR}:latest"
