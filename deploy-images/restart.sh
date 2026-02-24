#!/usr/bin/env bash
# Force new ECS deployment for specified services (or all if none specified).
# Picks up the latest image from ECR.
#
# Usage:
#   ./restart.sh                     # restart all services
#   ./restart.sh backend             # restart backend only
#   ./restart.sh backend reviewer-ui # restart backend + reviewer-ui
source "$(dirname "$0")/config.sh"

ALL_SERVICES=(
  "${SVC_BACKEND}"
  "${SVC_REVIEWER_UI}"
  "${SVC_HAPI_FHIR}"
  "${SVC_CTAKES}"
  "${SVC_REDIS}"
)

if [ $# -eq 0 ]; then
  SERVICES=("${ALL_SERVICES[@]}")
else
  SERVICES=()
  for arg in "$@"; do
    case "${arg}" in
      backend)      SERVICES+=("${SVC_BACKEND}") ;;
      reviewer-ui)  SERVICES+=("${SVC_REVIEWER_UI}") ;;
      hapi-fhir)    SERVICES+=("${SVC_HAPI_FHIR}") ;;
      ctakes)       SERVICES+=("${SVC_CTAKES}") ;;
      redis)        SERVICES+=("${SVC_REDIS}") ;;
      *)            echo "Unknown service: ${arg}"; echo "Valid: backend reviewer-ui hapi-fhir ctakes redis"; exit 1 ;;
    esac
  done
fi

echo "Restarting ${#SERVICES[@]} service(s)..."
for svc in "${SERVICES[@]}"; do
  echo "  Restarting ${svc}..."
  aws ecs update-service \
    --cluster "${ECS_CLUSTER}" \
    --service "${svc}" \
    --force-new-deployment \
    --region "${AWS_REGION}" \
    --query "service.{Service:serviceName,Status:status}" \
    --output text
done

echo ""
echo "Done. Monitor with:"
echo "  ./status.sh"
