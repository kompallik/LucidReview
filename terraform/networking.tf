# ═══════════════════════════════════════════════════════════════════════════════
# Security Groups
# ═══════════════════════════════════════════════════════════════════════════════

# ── ALB ──────────────────────────────────────────────────────────────────────
locals {
  alb_allowed_cidrs = [
    "172.22.0.0/16",    # VPN
    "172.109.133.2/32", # Office
    "172.29.0.0/16",    # VPN
    "3.228.81.40/32",   # VPN
    "104.226.237.202/32", # VPN
    "198.19.0.0/16",    # VPN
    "97.76.206.30/32",  # Tampa
  ]
}

resource "aws_security_group" "alb" {
  name        = "${local.prefix}-alb"
  description = "LucidReview ALB - allows HTTP/HTTPS from internet"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    description = "HTTP redirect - whitelisted CIDRs"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = local.alb_allowed_cidrs
  }

  ingress {
    description = "HTTPS - whitelisted CIDRs"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = local.alb_allowed_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Backend (Fastify API on port 3000) ────────────────────────────────────────
resource "aws_security_group" "backend" {
  name        = "${local.prefix}-backend"
  description = "LucidReview backend ECS tasks - accepts traffic from ALB"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    description     = "API from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Frontend (Nginx on port 80) ───────────────────────────────────────────────
resource "aws_security_group" "frontend" {
  name        = "${local.prefix}-frontend"
  description = "LucidReview frontend ECS tasks - accepts traffic from ALB"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    description     = "HTTP from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── HAPI FHIR (Spring Boot on port 8080) ─────────────────────────────────────
resource "aws_security_group" "hapi_fhir" {
  name        = "${local.prefix}-hapi-fhir"
  description = "LucidReview HAPI FHIR - internal only, accepts traffic from backend"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    description     = "FHIR API from backend"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── cTAKES / medspacy (Flask on port 8081) ───────────────────────────────────
resource "aws_security_group" "ctakes" {
  name        = "${local.prefix}-ctakes"
  description = "LucidReview cTAKES NLP - internal only, accepts traffic from backend"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    description     = "NLP API from backend"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Redis (port 6379) ─────────────────────────────────────────────────────────
resource "aws_security_group" "redis" {
  name        = "${local.prefix}-redis"
  description = "LucidReview Redis - internal only, accepts traffic from backend"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    description     = "Redis from backend"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Add LucidReview backend + HAPI FHIR to the existing RDS security group ───
resource "aws_security_group_rule" "rds_from_backend" {
  type                     = "ingress"
  description              = "MySQL from LucidReview backend"
  from_port                = 3306
  to_port                  = 3306
  protocol                 = "tcp"
  security_group_id        = data.aws_security_group.rds.id
  source_security_group_id = aws_security_group.backend.id
}

resource "aws_security_group_rule" "rds_from_hapi_fhir" {
  type                     = "ingress"
  description              = "MySQL from LucidReview HAPI FHIR"
  from_port                = 3306
  to_port                  = 3306
  protocol                 = "tcp"
  security_group_id        = data.aws_security_group.rds.id
  source_security_group_id = aws_security_group.hapi_fhir.id
}

# ═══════════════════════════════════════════════════════════════════════════════
# Application Load Balancer
# ═══════════════════════════════════════════════════════════════════════════════

resource "aws_lb" "main" {
  name               = "${local.prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [var.public_subnet_a_id, var.public_subnet_b_id]

  enable_deletion_protection = false
}

# ── Target Groups ─────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "backend" {
  name                 = "${local.prefix}-backend"
  port                 = 3000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = data.aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path                = "/api/health"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 10
    matcher             = "200"
  }
}

resource "aws_lb_target_group" "frontend" {
  name                 = "${local.prefix}-frontend"
  port                 = 80
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = data.aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path                = "/"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 10
    matcher             = "200"
  }
}

# ── Listeners ─────────────────────────────────────────────────────────────────

# HTTP → redirect to HTTPS
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS - default action routes to frontend, path rules route API traffic to backend
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# /api/* → backend
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# /cds-hooks/* → backend
resource "aws_lb_listener_rule" "cds_hooks" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/cds-hooks/*"]
    }
  }
}
