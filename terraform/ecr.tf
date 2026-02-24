# ECR repositories for custom-built LucidReview images.
# Public images (hapiproject/hapi, redis) are pulled directly from ECR Public/Docker Hub.

resource "aws_ecr_repository" "backend" {
  name                 = "${local.prefix}/backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "reviewer_ui" {
  name                 = "${local.prefix}/reviewer-ui"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "ctakes" {
  name                 = "${local.prefix}/ctakes"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Lifecycle policy – keep the 10 most recent tagged images for each repo
locals {
  ecr_lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 tagged images"
        selection = {
          tagStatus   = "tagged"
          tagPrefixList = ["v", "latest", "main"]
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expire untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      }
    ]
  })
}

resource "aws_ecr_repository" "hapi_fhir" {
  name                 = "${local.prefix}/hapi-fhir"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "hapi_fhir" {
  repository = aws_ecr_repository.hapi_fhir.name
  policy     = local.ecr_lifecycle_policy
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy     = local.ecr_lifecycle_policy
}

resource "aws_ecr_lifecycle_policy" "reviewer_ui" {
  repository = aws_ecr_repository.reviewer_ui.name
  policy     = local.ecr_lifecycle_policy
}

resource "aws_ecr_lifecycle_policy" "ctakes" {
  repository = aws_ecr_repository.ctakes.name
  policy     = local.ecr_lifecycle_policy
}
