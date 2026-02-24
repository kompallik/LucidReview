# ── General ───────────────────────────────────────────────────────────────────
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-2"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

# ── Existing infrastructure ───────────────────────────────────────────────────
variable "existing_vpc_id" {
  description = "Existing VPC shared with document-ai and Specter"
  type        = string
  default     = "vpc-0f059e0a3942b2e62"
}

# Public subnets – used by the Application Load Balancer (requires 2 AZs)
variable "public_subnet_a_id" {
  description = "document-ai-prod-public-a (us-east-2a)"
  type        = string
  default     = "subnet-0791c0e76fc4f0e81"
}

variable "public_subnet_b_id" {
  description = "document-ai-prod-public-b (us-east-2b)"
  type        = string
  default     = "subnet-04d65e25a325fb1aa"
}

# Private subnets – used by ECS tasks
variable "private_subnet_a_id" {
  description = "document-ai-prod-private-a (us-east-2a)"
  type        = string
  default     = "subnet-04f8452c1e1aed8f2"
}

variable "private_subnet_b_id" {
  description = "document-ai-prod-private-b (us-east-2b)"
  type        = string
  default     = "subnet-0e528249bc454aa72"
}

variable "existing_rds_security_group_id" {
  description = "Existing RDS security group – LucidReview SGs will be added as ingress sources"
  type        = string
  default     = "sg-05688873549501754"
}

variable "existing_task_role_name" {
  description = "Existing IAM task role that already has Bedrock invocation permissions"
  type        = string
  default     = "AmazonBedrockExecutionRoleForFlows_YX9G86Z5WQ"
}

variable "acm_certificate_arn" {
  description = "Wildcard ACM certificate for *.mhkdevsandbox.com"
  type        = string
  default     = "arn:aws:acm:us-east-2:323960442001:certificate/53bcdad7-3adc-4c90-b7c9-b8cfef4cdd3d"
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for mhkdevsandbox.com"
  type        = string
  default     = "ZQM27GCSMD8BI"
}

variable "domain_name" {
  description = "FQDN for the LucidReview application"
  type        = string
  default     = "lucidreview.mhkdevsandbox.com"
}

# ── Database ──────────────────────────────────────────────────────────────────
variable "db_host" {
  description = "Existing RDS MySQL endpoint (reused from document-ai)"
  type        = string
  default     = "document-ai-prod-mysql.cxtyszxlzcsj.us-east-2.rds.amazonaws.com"
}

variable "db_port" {
  description = "MySQL port"
  type        = number
  default     = 3306
}

variable "db_name" {
  description = "LucidReview application database schema name"
  type        = string
  default     = "lucidreview"
}

variable "hapi_fhir_db_name" {
  description = "HAPI FHIR database schema name (auto-created by HAPI on first start)"
  type        = string
  default     = "hapi_fhir"
}

variable "db_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret for LucidReview DB credentials (keys: username, password)"
  type        = string
  # Populated in terraform.tfvars after creating the secret or referencing existing
}

# ── Application ───────────────────────────────────────────────────────────────
variable "bedrock_model_id" {
  description = "AWS Bedrock model ID for Claude"
  type        = string
  default     = "us.anthropic.claude-sonnet-4-6"
}

# ── ECS task sizing ───────────────────────────────────────────────────────────
variable "backend_cpu" {
  description = "Backend task CPU units (1024 = 1 vCPU)"
  type        = number
  default     = 1024
}

variable "backend_memory" {
  description = "Backend task memory in MB"
  type        = number
  default     = 2048
}

variable "backend_desired_count" {
  description = "Number of backend tasks"
  type        = number
  default     = 1
}

variable "frontend_cpu" {
  description = "Frontend (Nginx) task CPU units"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Frontend task memory in MB"
  type        = number
  default     = 512
}

variable "frontend_desired_count" {
  description = "Number of frontend tasks"
  type        = number
  default     = 1
}

variable "hapi_fhir_cpu" {
  description = "HAPI FHIR task CPU units (Java needs headroom)"
  type        = number
  default     = 2048
}

variable "hapi_fhir_memory" {
  description = "HAPI FHIR task memory in MB"
  type        = number
  default     = 4096
}

variable "hapi_fhir_desired_count" {
  description = "Number of HAPI FHIR tasks"
  type        = number
  default     = 1
}

variable "ctakes_cpu" {
  description = "cTAKES/medspacy task CPU units"
  type        = number
  default     = 512
}

variable "ctakes_memory" {
  description = "cTAKES/medspacy task memory in MB"
  type        = number
  default     = 1024
}

variable "ctakes_desired_count" {
  description = "Number of cTAKES tasks"
  type        = number
  default     = 1
}

variable "redis_cpu" {
  description = "Redis task CPU units"
  type        = number
  default     = 256
}

variable "redis_memory" {
  description = "Redis task memory in MB"
  type        = number
  default     = 512
}

variable "redis_desired_count" {
  description = "Number of Redis tasks (keep at 1 – BullMQ uses a single queue)"
  type        = number
  default     = 1
}

# ── Logging ───────────────────────────────────────────────────────────────────
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}
