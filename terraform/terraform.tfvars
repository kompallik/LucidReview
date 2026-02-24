# ── General ───────────────────────────────────────────────────────────────────
aws_region  = "us-east-2"
environment = "prod"

# ── Existing infrastructure ───────────────────────────────────────────────────
existing_vpc_id                = "vpc-0f059e0a3942b2e62"
public_subnet_a_id             = "subnet-0791c0e76fc4f0e81"   # document-ai-prod-public-a  (us-east-2a)
public_subnet_b_id             = "subnet-04d65e25a325fb1aa"   # document-ai-prod-public-b  (us-east-2b)
private_subnet_a_id            = "subnet-04f8452c1e1aed8f2"   # document-ai-prod-private-a (us-east-2a)
private_subnet_b_id            = "subnet-0e528249bc454aa72"   # document-ai-prod-private-b (us-east-2b)
existing_rds_security_group_id = "sg-05688873549501754"
existing_task_role_name        = "AmazonBedrockExecutionRoleForFlows_YX9G86Z5WQ"
acm_certificate_arn            = "arn:aws:acm:us-east-2:323960442001:certificate/53bcdad7-3adc-4c90-b7c9-b8cfef4cdd3d"
route53_zone_id                = "ZQM27GCSMD8BI"
domain_name                    = "lucidreview.mhkdevsandbox.com"

# ── Database ──────────────────────────────────────────────────────────────────
db_host          = "document-ai-prod-mysql.cxtyszxlzcsj.us-east-2.rds.amazonaws.com"
db_port          = 3306
db_name          = "lucidreview"
hapi_fhir_db_name = "hapi_fhir"

# ARN of the Secrets Manager secret that holds the LucidReview DB credentials
# (keys: username, password).
# Steps to set this up:
#   1. Create a MySQL user for LucidReview in RDS (via bastion):
#        CREATE USER 'lucidreview'@'%' IDENTIFIED BY '<strong-password>';
#        GRANT ALL ON lucidreview.* TO 'lucidreview'@'%';
#        GRANT ALL ON hapi_fhir.*   TO 'lucidreview'@'%';
#   2. Create a secret:
#        aws secretsmanager create-secret \
#          --name lucidreview/database/credentials \
#          --region us-east-2 \
#          --secret-string '{"username":"lucidreview","password":"<strong-password>"}'
#   3. Paste the returned ARN here:
db_credentials_secret_arn = "arn:aws:secretsmanager:us-east-2:323960442001:secret:lucidreview/database/credentials-euQJH2"

# ── Application ───────────────────────────────────────────────────────────────
bedrock_model_id = "us.anthropic.claude-sonnet-4-6"

# ── ECS task sizing ───────────────────────────────────────────────────────────
backend_cpu           = 1024
backend_memory        = 2048
backend_desired_count = 1

frontend_cpu           = 256
frontend_memory        = 512
frontend_desired_count = 1

hapi_fhir_cpu           = 2048
hapi_fhir_memory        = 4096
hapi_fhir_desired_count = 1

ctakes_cpu           = 512
ctakes_memory        = 1024
ctakes_desired_count = 1

redis_cpu           = 256
redis_memory        = 512
redis_desired_count = 1

# ── Logging ───────────────────────────────────────────────────────────────────
log_retention_days = 30
