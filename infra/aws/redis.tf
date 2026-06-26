# ── ElastiCache Redis (Socket.io pub/sub across backend instances) ─────────────
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id
  tags       = local.tags
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${local.name}-redis"
  description          = "Socket.io pub/sub + session cache"

  node_type            = "cache.t4g.medium"
  num_cache_clusters   = 2 # primary + replica for HA
  parameter_group_name = "default.redis7"
  engine_version       = "7.1"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = true
  multi_az_enabled           = true

  tags = merge(local.tags, { Name = "${local.name}-redis" })
}
