variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "resource_group_name" {
  description = "The name of the resource group"
  type        = string
}

variable "key_vault_id" {
  description = "The ID of the Key Vault to store the Gotenberg basic auth credentials"
  type        = string
}

variable "image" {
  description = "Gotenberg container image"
  type        = string
  default     = "docker.io/gotenberg/gotenberg:8"
}

variable "cpu" {
  description = "vCPU cores allocated to the Gotenberg container (Container Apps Consumption plan requires this to pair with `memory` from a fixed set, e.g. 0.5/1Gi, 1.0/2Gi)"
  type        = number
  default     = 0.5
}

variable "memory" {
  description = "Memory allocated to the Gotenberg container, e.g. \"1Gi\" (Container Apps Consumption plan requires this to pair with `cpu` from a fixed set)"
  type        = string
  default     = "1Gi"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
