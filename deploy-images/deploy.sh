#!/usr/bin/env bash
# Full deploy: build, push, and restart specified services (or all).
#
# Usage:
#   ./deploy.sh                     # deploy everything
#   ./deploy.sh backend             # build + restart backend only
#   ./deploy.sh backend reviewer-ui # build + restart backend + reviewer-ui
source "$(dirname "$0")/config.sh"

SCRIPT_DIR="$(dirname "$0")"

# ECR login
"${SCRIPT_DIR}/ecr-login.sh"
echo ""

if [ $# -eq 0 ]; then
  # Deploy all
  "${SCRIPT_DIR}/build-backend.sh"
  echo ""
  "${SCRIPT_DIR}/build-reviewer-ui.sh"
  echo ""
  "${SCRIPT_DIR}/build-ctakes.sh"
  echo ""
  "${SCRIPT_DIR}/build-hapi-fhir.sh"
  echo ""
  "${SCRIPT_DIR}/restart.sh"
else
  # Deploy only specified services
  for arg in "$@"; do
    case "${arg}" in
      backend)      "${SCRIPT_DIR}/build-backend.sh" ;;
      reviewer-ui)  "${SCRIPT_DIR}/build-reviewer-ui.sh" ;;
      ctakes)       "${SCRIPT_DIR}/build-ctakes.sh" ;;
      hapi-fhir)    "${SCRIPT_DIR}/build-hapi-fhir.sh" ;;
      redis)        echo "Redis uses a public image — skipping build" ;;
      *)            echo "Unknown service: ${arg}"; exit 1 ;;
    esac
    echo ""
  done
  "${SCRIPT_DIR}/restart.sh" "$@"
fi

echo ""
"${SCRIPT_DIR}/status.sh"
