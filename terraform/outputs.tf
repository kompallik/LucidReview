# ── URLs ──────────────────────────────────────────────────────────────────────
output "app_url" {
  description = "LucidReview application URL"
  value       = "https://${var.domain_name}"
}

output "alb_dns_name" {
  description = "ALB DNS name (the Route53 record aliases this)"
  value       = aws_lb.main.dns_name
}

# ── ECS ───────────────────────────────────────────────────────────────────────
output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

# ── ECR image push commands ───────────────────────────────────────────────────
output "ecr_login_command" {
  description = "Authenticate Docker to ECR"
  value       = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

output "ecr_urls" {
  description = "ECR repository URLs for image tagging/pushing"
  value = {
    backend     = aws_ecr_repository.backend.repository_url
    reviewer_ui = aws_ecr_repository.reviewer_ui.repository_url
    ctakes      = aws_ecr_repository.ctakes.repository_url
  }
}

output "build_and_push_commands" {
  description = "Commands to build and push all images to ECR (run from repo root)"
  value       = <<-EOT
    # 1. Authenticate
    aws ecr get-login-password --region ${var.aws_region} | \
      docker login --username AWS --password-stdin ${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com

    # 2. Backend
    docker build -t ${aws_ecr_repository.backend.repository_url}:latest \
      -f packages/backend/Dockerfile .
    docker push ${aws_ecr_repository.backend.repository_url}:latest

    # 3. Reviewer UI  (build arg sets the production API URL)
    docker build -t ${aws_ecr_repository.reviewer_ui.repository_url}:latest \
      --build-arg VITE_API_URL=https://${var.domain_name} \
      -f packages/reviewer-ui/Dockerfile .
    docker push ${aws_ecr_repository.reviewer_ui.repository_url}:latest

    # 4. cTAKES
    docker build -t ${aws_ecr_repository.ctakes.repository_url}:latest \
      docker/ctakes/
    docker push ${aws_ecr_repository.ctakes.repository_url}:latest

    # 5. Force new ECS deployments to pick up updated images
    aws ecs update-service --cluster ${aws_ecs_cluster.main.name} \
      --service ${aws_ecs_service.backend.name} --force-new-deployment --region ${var.aws_region}
    aws ecs update-service --cluster ${aws_ecs_cluster.main.name} \
      --service ${aws_ecs_service.reviewer_ui.name} --force-new-deployment --region ${var.aws_region}
    aws ecs update-service --cluster ${aws_ecs_cluster.main.name} \
      --service ${aws_ecs_service.ctakes.name} --force-new-deployment --region ${var.aws_region}
  EOT
}

# ── Secrets ───────────────────────────────────────────────────────────────────
output "jwt_secret_arn" {
  description = "ARN of the JWT secret in Secrets Manager"
  value       = aws_secretsmanager_secret.jwt.arn
}

# ── Useful tail commands ──────────────────────────────────────────────────────
output "tail_logs" {
  description = "Commands to tail ECS logs in CloudWatch"
  value = {
    backend   = "aws logs tail /ecs/lucidreview/backend   --follow --region ${var.aws_region}"
    frontend  = "aws logs tail /ecs/lucidreview/reviewer-ui --follow --region ${var.aws_region}"
    hapi_fhir = "aws logs tail /ecs/lucidreview/hapi-fhir  --follow --region ${var.aws_region}"
    ctakes    = "aws logs tail /ecs/lucidreview/ctakes     --follow --region ${var.aws_region}"
    redis     = "aws logs tail /ecs/lucidreview/redis      --follow --region ${var.aws_region}"
  }
}

# ── Run DB migrations (from local machine via bastion tunnel) ─────────────────
output "migration_command" {
  description = "Run Knex migrations against the production RDS (requires bastion tunnel on port 13306)"
  value       = "DB_HOST=127.0.0.1 DB_PORT=13306 DB_NAME=${var.db_name} pnpm migrate"
}
