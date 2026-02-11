variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile"
  type        = string
  default     = "serverless-admin"
}

variable "project_name" {
  description = "Project name used for tagging and resource naming"
  type        = string
  default     = "helloworld-poc"
}

variable "key_pair_name" {
  description = "Existing EC2 key pair name for SSH access"
  type        = string
  default     = "helloworld-deploy"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t4g.small"
}

variable "github_repo" {
  description = "GitHub repository in format owner/repo"
  type        = string
  default     = "gskudlarick/helloworld"
}

variable "vpc_id" {
  description = "VPC ID (no default VPC exists in this account)"
  type        = string
  default     = "vpc-08883d567c092ac07"
}

variable "subnet_id" {
  description = "Public subnet ID for the EC2 instance"
  type        = string
  default     = "subnet-0117e60f7aa1fca15"
}
