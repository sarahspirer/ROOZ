variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "prod or staging"
  type        = string
  default     = "prod"
}

variable "db_password" {
  description = "RDS master password — set via TF_VAR_db_password env var, never commit"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret (min 32 chars) — set via TF_VAR_jwt_secret"
  type        = string
  sensitive   = true
}

variable "backend_image" {
  description = "ECR image URI for the backend, e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/rooz-backend:latest"
  type        = string
}

variable "dashboard_domain" {
  description = "Custom domain for the dashboard, e.g. app.rooz.school"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS (us-east-1 for CloudFront)"
  type        = string
  default     = ""
}
