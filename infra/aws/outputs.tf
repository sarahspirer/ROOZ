output "alb_dns" {
  description = "ALB DNS — point your API subdomain here"
  value       = aws_lb.main.dns_name
}

output "cloudfront_domain" {
  description = "CloudFront URL — point your dashboard domain here"
  value       = aws_cloudfront_distribution.dashboard.domain_name
}

output "ecr_repository_url" {
  description = "Push your backend Docker image here"
  value       = aws_ecr_repository.backend.repository_url
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (internal)"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint (internal)"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "dashboard_bucket" {
  description = "S3 bucket — sync your Vite build here"
  value       = aws_s3_bucket.dashboard.bucket
}
