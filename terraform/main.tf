terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "LucidReview"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ── Current account identity ──────────────────────────────────────────────────
data "aws_caller_identity" "current" {}

# ── Existing VPC ──────────────────────────────────────────────────────────────
data "aws_vpc" "main" {
  id = var.existing_vpc_id
}

# ── Existing RDS security group (we add ingress rules to it) ─────────────────
data "aws_security_group" "rds" {
  id = var.existing_rds_security_group_id
}

# ── Existing IAM task role (has Bedrock permissions) ─────────────────────────
data "aws_iam_role" "task_role" {
  name = var.existing_task_role_name
}

# ACM wildcard certificate ARN is referenced directly via var.acm_certificate_arn
# (aws_acm_certificate data source requires domain lookup, not ARN lookup)

# ── Route53 hosted zone for mhkdevsandbox.com ────────────────────────────────
data "aws_route53_zone" "main" {
  zone_id = var.route53_zone_id
}

locals {
  prefix     = "lucidreview"
  account_id = data.aws_caller_identity.current.account_id
}
