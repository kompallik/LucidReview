#!/usr/bin/env bash
# Shared configuration for all deploy scripts

set -euo pipefail

AWS_REGION="us-east-2"
AWS_ACCOUNT_ID="323960442001"
ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ECS_CLUSTER="lucidreview-cluster"
PLATFORM="linux/amd64"
DOMAIN="https://lucidreview.mhkdevsandbox.com"

# ECR repository URLs
ECR_BACKEND="${ECR_BASE}/lucidreview/backend"
ECR_REVIEWER_UI="${ECR_BASE}/lucidreview/reviewer-ui"
ECR_CTAKES="${ECR_BASE}/lucidreview/ctakes"
ECR_HAPI_FHIR="${ECR_BASE}/lucidreview/hapi-fhir"

# ECS service names
SVC_BACKEND="lucidreview-backend"
SVC_REVIEWER_UI="lucidreview-reviewer-ui"
SVC_CTAKES="lucidreview-ctakes"
SVC_HAPI_FHIR="lucidreview-hapi-fhir"
SVC_REDIS="lucidreview-redis"

# Repo root (relative to deploy-images/)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
