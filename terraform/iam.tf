# ── ECS Execution Role ────────────────────────────────────────────────────────
# Allows ECS to pull images from ECR and write logs to CloudWatch.
# Distinct from the Task Role (which runs inside the container).

resource "aws_iam_role" "ecs_execution" {
  name = "LucidReviewECSExecutionRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow the execution role to read the DB credentials and JWT secret from Secrets Manager
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "LucidReviewSecretsAccess"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          var.db_credentials_secret_arn,
          aws_secretsmanager_secret.jwt.arn,
        ]
      },
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = ["kms:Decrypt"]
        # Allow decryption of any key in the account (secrets may use different KMS keys)
        Resource = "arn:aws:kms:${var.aws_region}:${local.account_id}:key/*"
      }
    ]
  })
}

# ── Task Role – extend existing role with Textract (used by mcp-server) ───────
# The existing task role already has Bedrock permissions.
# We attach an inline policy for Amazon Textract (PDF extraction in mcp-server).

resource "aws_iam_role_policy" "task_textract" {
  name = "LucidReviewTextractAccess"
  role = data.aws_iam_role.task_role.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "TextractAnalysis"
      Effect   = "Allow"
      Action   = [
        "textract:DetectDocumentText",
        "textract:AnalyzeDocument",
        "textract:StartDocumentTextDetection",
        "textract:GetDocumentTextDetection"
      ]
      Resource = "*"
    }]
  })
}
