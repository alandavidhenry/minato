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
  description = "CPU cores allocated to the Gotenberg container"
  type        = number
  default     = 1
}

variable "memory" {
  description = "Memory in GB allocated to the Gotenberg container"
  type        = number
  default     = 2
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
