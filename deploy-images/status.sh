#!/usr/bin/env bash
# Show status of all ECS services and ALB target health
source "$(dirname "$0")/config.sh"

echo "=== ECS Services ==="
aws ecs describe-services \
  --cluster "${ECS_CLUSTER}" \
  --services "${SVC_BACKEND}" "${SVC_REVIEWER_UI}" "${SVC_HAPI_FHIR}" "${SVC_CTAKES}" "${SVC_REDIS}" \
  --query "services[*].{Name:serviceName,Running:runningCount,Desired:desiredCount,State:deployments[0].rolloutState}" \
  --output table --region "${AWS_REGION}"

echo ""
echo "=== ALB Target Health: backend ==="
aws elbv2 describe-target-health \
  --target-group-arn "$(aws elbv2 describe-target-groups --names lucidreview-backend --region "${AWS_REGION}" --query "TargetGroups[0].TargetGroupArn" --output text)" \
  --region "${AWS_REGION}" \
  --query "TargetHealthDescriptions[*].{IP:Target.Id,Health:TargetHealth.State}" \
  --output table

echo ""
echo "=== ALB Target Health: frontend ==="
aws elbv2 describe-target-health \
  --target-group-arn "$(aws elbv2 describe-target-groups --names lucidreview-frontend --region "${AWS_REGION}" --query "TargetGroups[0].TargetGroupArn" --output text)" \
  --region "${AWS_REGION}" \
  --query "TargetHealthDescriptions[*].{IP:Target.Id,Health:TargetHealth.State}" \
  --output table
