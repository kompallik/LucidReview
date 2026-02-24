resource "random_password" "jwt_secret" {
  length  = 64
  special = false  # special chars break ECS Secrets Manager JSON parsing
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "lucidreview/jwt-secret"
  description             = "JWT signing secret for LucidReview API"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt_secret.result
}
