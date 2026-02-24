# ═══════════════════════════════════════════════════════════════════════════════
# ECS Cluster + Service Connect namespace
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_ecs_cluster" "main" {
  name = "${local.prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Cloud Map HTTP namespace for ECS Service Connect.
# Services discover each other by name: hapi-fhir:8080, ctakes:8080, redis:6379
resource "aws_service_discovery_http_namespace" "main" {
  name        = "${local.prefix}.local"
  description = "LucidReview internal service mesh"
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Task Definitions
# ═══════════════════════════════════════════════════════════════════════════════

# ── Redis ─────────────────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "redis" {
  family                   = "${local.prefix}-redis"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.redis_cpu
  memory                   = var.redis_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  # Redis itself doesn't need AWS API access
  task_role_arn = data.aws_iam_role.task_role.arn

  container_definitions = jsonencode([
    {
      name      = "redis"
      image     = "public.ecr.aws/docker/library/redis:7-alpine"
      essential = true

      command = ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]

      portMappings = [
        {
          name          = "redis"
          containerPort = 6379
          hostPort      = 6379
          protocol      = "tcp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.services["redis"].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "redis-cli ping | grep -q PONG"]
        interval    = 15
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
    }
  ])
}

# ── cTAKES / medspacy ─────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "ctakes" {
  family                   = "${local.prefix}-ctakes"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.ctakes_cpu
  memory                   = var.ctakes_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = data.aws_iam_role.task_role.arn

  container_definitions = jsonencode([
    {
      name      = "ctakes"
      image     = "${aws_ecr_repository.ctakes.repository_url}:latest"
      essential = true

      portMappings = [
        {
          name          = "http"
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
          appProtocol   = "http"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.services["ctakes"].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        # curl not in python:3.11-slim — use Python built-in urllib instead
        command     = ["CMD-SHELL", "python3 -c \"import urllib.request; urllib.request.urlopen('http://localhost:8080/health', timeout=5)\" || exit 1"]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

# ── HAPI FHIR ─────────────────────────────────────────────────────────────────
# Uses the official hapiproject/hapi:latest image, fully configured via
# Spring Boot environment variables (no custom Dockerfile needed).
resource "aws_ecs_task_definition" "hapi_fhir" {
  family                   = "${local.prefix}-hapi-fhir"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.hapi_fhir_cpu
  memory                   = var.hapi_fhir_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = data.aws_iam_role.task_role.arn

  container_definitions = jsonencode([
    {
      name      = "hapi-fhir"
      # Custom image: extends hapiproject/hapi:latest with /app/config/application.yaml baked in.
      # The official image ignores SPRING_DATASOURCE_URL env vars and defaults to H2 in-memory.
      # The only reliable override is /app/config/application.yaml at the filesystem level.
      image     = "${aws_ecr_repository.hapi_fhir.repository_url}:latest"
      essential = true

      portMappings = [
        {
          name          = "http"
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
          appProtocol   = "http"
        }
      ]

      environment = [
        # JVM heap size tuned for the allocated memory (leave ~512 MB for OS + JVM overhead)
        { name = "JAVA_TOOL_OPTIONS", value = "-Xmx3g -Xms512m" }
      ]

      secrets = [
        { name = "SPRING_DATASOURCE_USERNAME", valueFrom = "${var.db_credentials_secret_arn}:username::" },
        { name = "SPRING_DATASOURCE_PASSWORD", valueFrom = "${var.db_credentials_secret_arn}:password::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.services["hapi_fhir"].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      # No container health check — hapiproject/hapi is distroless (no shell, no curl).
      # ECS monitors the container's running state (exit code) instead.
    }
  ])
}

# ── Backend (Fastify API) ─────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = data.aws_iam_role.task_role.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      portMappings = [
        {
          name          = "http"
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
          appProtocol   = "http"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "DB_HOST", value = var.db_host },
        { name = "DB_PORT", value = tostring(var.db_port) },
        { name = "DB_NAME", value = var.db_name },
        # Service Connect resolves these names within the ECS namespace
        { name = "HAPI_FHIR_URL", value = "http://hapi-fhir:8080/fhir" },
        { name = "CTAKES_URL", value = "http://ctakes:8080" },
        { name = "REDIS_URL", value = "redis://redis:6379" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "BEDROCK_MODEL_ID", value = var.bedrock_model_id },
        { name = "MCP_SERVER_PATH", value = "/app/packages/mcp-server/dist/index.js" },
        { name = "CORS_ORIGINS", value = "https://${var.domain_name}" },
        { name = "LOG_LEVEL", value = "warn" }
      ]

      secrets = [
        { name = "DB_USER", valueFrom = "${var.db_credentials_secret_arn}:username::" },
        { name = "DB_PASSWORD", valueFrom = "${var.db_credentials_secret_arn}:password::" },
        { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret_version.jwt.arn }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.services["backend"].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        # curl is not in node:22-slim — use Node.js built-in http module instead
        command     = ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3000/api/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\""]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

# ── Reviewer UI (Nginx + React SPA) ──────────────────────────────────────────
resource "aws_ecs_task_definition" "reviewer_ui" {
  family                   = "${local.prefix}-reviewer-ui"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = data.aws_iam_role.task_role.arn

  container_definitions = jsonencode([
    {
      name      = "reviewer-ui"
      image     = "${aws_ecr_repository.reviewer_ui.repository_url}:latest"
      essential = true

      portMappings = [
        {
          name          = "http"
          containerPort = 80
          hostPort      = 80
          protocol      = "tcp"
          appProtocol   = "http"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.services["reviewer_ui"].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:80/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 15
      }
    }
  ])
}

# ═══════════════════════════════════════════════════════════════════════════════
# ECS Services
# ═══════════════════════════════════════════════════════════════════════════════

# ── Redis ─────────────────────────────────────────────────────────────────────
resource "aws_ecs_service" "redis" {
  name            = "${local.prefix}-redis"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.redis.arn
  desired_count   = var.redis_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [var.private_subnet_a_id, var.private_subnet_b_id]
    security_groups  = [aws_security_group.redis.id]
    assign_public_ip = false
  }

  # Redis is a server – other services connect to it via Service Connect
  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name      = "redis"
      discovery_name = "redis"
      client_alias {
        port     = 6379
        dns_name = "redis"
      }
    }
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# ── cTAKES ────────────────────────────────────────────────────────────────────
resource "aws_ecs_service" "ctakes" {
  name            = "${local.prefix}-ctakes"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ctakes.arn
  desired_count   = var.ctakes_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [var.private_subnet_a_id, var.private_subnet_b_id]
    security_groups  = [aws_security_group.ctakes.id]
    assign_public_ip = false
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name      = "http"
      discovery_name = "ctakes"
      client_alias {
        port     = 8081
        dns_name = "ctakes"
      }
    }
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# ── HAPI FHIR ─────────────────────────────────────────────────────────────────
resource "aws_ecs_service" "hapi_fhir" {
  name            = "${local.prefix}-hapi-fhir"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.hapi_fhir.arn
  desired_count   = var.hapi_fhir_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [var.private_subnet_a_id, var.private_subnet_b_id]
    security_groups  = [aws_security_group.hapi_fhir.id]
    assign_public_ip = false
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name      = "http"
      discovery_name = "hapi-fhir"
      client_alias {
        port     = 8080
        dns_name = "hapi-fhir"
      }
    }
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# ── Backend API ───────────────────────────────────────────────────────────────
resource "aws_ecs_service" "backend" {
  name            = "${local.prefix}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [var.private_subnet_a_id, var.private_subnet_b_id]
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3000
  }

  # Backend is a client that connects to hapi-fhir, ctakes, and redis
  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn
    # No server block – backend is accessed via ALB, not Service Connect
  }

  depends_on = [
    aws_lb_listener.https,
    aws_ecs_service.redis,
    aws_ecs_service.hapi_fhir,
    aws_ecs_service.ctakes,
  ]

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# ── Frontend ──────────────────────────────────────────────────────────────────
resource "aws_ecs_service" "reviewer_ui" {
  name            = "${local.prefix}-reviewer-ui"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.reviewer_ui.arn
  desired_count   = var.frontend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [var.private_subnet_a_id, var.private_subnet_b_id]
    security_groups  = [aws_security_group.frontend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "reviewer-ui"
    container_port   = 80
  }

  depends_on = [aws_lb_listener.https]

  lifecycle {
    ignore_changes = [desired_count]
  }
}
