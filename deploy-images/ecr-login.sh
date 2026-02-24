#!/usr/bin/env bash
# Authenticate Docker to ECR
source "$(dirname "$0")/config.sh"

echo "Authenticating Docker to ECR (${AWS_REGION})..."
aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login --username AWS --password-stdin "${ECR_BASE}"
