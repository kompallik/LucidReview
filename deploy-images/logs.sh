#!/usr/bin/env bash
# Tail logs for a service.
#
# Usage:
#   ./logs.sh backend       # tail backend logs
#   ./logs.sh hapi-fhir     # tail HAPI FHIR logs
#   ./logs.sh reviewer-ui   # tail frontend logs
source "$(dirname "$0")/config.sh"

if [ $# -eq 0 ]; then
  echo "Usage: ./logs.sh <service>"
  echo "Services: backend, reviewer-ui, hapi-fhir, ctakes, redis"
  exit 1
fi

case "$1" in
  backend)      LOG_GROUP="/ecs/lucidreview/backend" ;;
  reviewer-ui)  LOG_GROUP="/ecs/lucidreview/reviewer-ui" ;;
  hapi-fhir)    LOG_GROUP="/ecs/lucidreview/hapi-fhir" ;;
  ctakes)       LOG_GROUP="/ecs/lucidreview/ctakes" ;;
  redis)        LOG_GROUP="/ecs/lucidreview/redis" ;;
  *)            echo "Unknown service: $1"; exit 1 ;;
esac

echo "Tailing ${LOG_GROUP} (Ctrl+C to stop)..."
aws logs tail "${LOG_GROUP}" --follow --region "${AWS_REGION}"
