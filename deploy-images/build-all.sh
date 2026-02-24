#!/usr/bin/env bash
# Build and push ALL images to ECR
source "$(dirname "$0")/config.sh"

SCRIPT_DIR="$(dirname "$0")"

echo "=== ECR Login ==="
"${SCRIPT_DIR}/ecr-login.sh"

echo ""
echo "=== Building all images ==="
"${SCRIPT_DIR}/build-backend.sh"
echo ""
"${SCRIPT_DIR}/build-reviewer-ui.sh"
echo ""
"${SCRIPT_DIR}/build-ctakes.sh"
echo ""
"${SCRIPT_DIR}/build-hapi-fhir.sh"

echo ""
echo "=== All images pushed ==="
