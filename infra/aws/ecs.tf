# ── ECR repository ────────────────────────────────────────────────────────────
resource "aws_ecr_repository" "backend" {
  name                 = "rooz-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

# ── ECS cluster ───────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# ── IAM role for ECS tasks ────────────────────────────────────────────────────
resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow reading secrets from SSM
resource "aws_iam_role_policy" "ecs_ssm" {
  name = "${local.name}-ecs-ssm"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameters", "ssm:GetParameter"]
      Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/rooz/*"
    }]
  })
}

# ── SSM secrets ───────────────────────────────────────────────────────────────
resource "aws_ssm_parameter" "db_url" {
  name  = "/rooz/DATABASE_URL"
  type  = "SecureString"
  value = "postgresql://rooz:${var.db_password}@${aws_db_instance.postgres.endpoint}/rooz"
  tags  = local.tags
}

resource "aws_ssm_parameter" "redis_url" {
  name  = "/rooz/REDIS_URL"
  type  = "SecureString"
  value = "rediss://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
  tags  = local.tags
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/rooz/JWT_SECRET"
  type  = "SecureString"
  value = var.jwt_secret
  tags  = local.tags
}

# ── CloudWatch log group ──────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name}-backend"
  retention_in_days = 30
  tags              = local.tags
}

# ── ECS task definition ───────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024" # 1 vCPU — scale up as needed
  memory                   = "2048" # 2 GB
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name  = "backend"
    image = var.backend_image

    portMappings = [{
      containerPort = 3001
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3001" },
      { name = "CORS_ORIGIN", value = "https://${var.dashboard_domain}" },
    ]

    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_ssm_parameter.db_url.arn },
      { name = "REDIS_URL",    valueFrom = aws_ssm_parameter.redis_url.arn },
      { name = "JWT_SECRET",   valueFrom = aws_ssm_parameter.jwt_secret.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.backend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "backend"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:3001/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])

  tags = local.tags
}

# ── ECS service ───────────────────────────────────────────────────────────────
resource "aws_ecs_service" "backend" {
  name            = "${local.name}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2 # always 2 tasks for HA

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 100
    base              = 1
  }

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.backend.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3001
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  depends_on = [aws_lb_listener.https]

  tags = local.tags

  lifecycle {
    ignore_changes = [desired_count] # managed by auto-scaling
  }
}

# ── Auto-scaling ──────────────────────────────────────────────────────────────
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = 20
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "${local.name}-backend-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 60.0 # scale up when CPU > 60%
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
