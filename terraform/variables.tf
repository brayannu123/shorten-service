variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "shorten-service"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "redirect_base_url" {
  description = "Base URL of redirect-service, for example https://abc.execute-api.us-east-1.amazonaws.com/dev"
  type        = string
  default     = ""
}
