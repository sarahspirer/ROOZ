terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to store state in S3 after you create the bucket
  # backend "s3" {
  #   bucket = "rooz-terraform-state"
  #   key    = "prod/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region
}

# ── Data ──────────────────────────────────────────────────────────────────────
data "aws_availability_zones" "available" {}

locals {
  name = "rooz-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)

  tags = {
    Project     = "rooz"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
