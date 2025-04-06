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
  description = "Resource group name"
  type        = string
  default     = null
}

variable "app_service_sku" {
  description = "App Service plan SKU"
  type        = string
  default     = "B1"
}

variable "https_only" {
  description = "Force HTTPS for all traffic"
  type        = bool
  default     = true
}

variable "redirect_uris" {
  description = "Redirect URIs for the application"
  type        = list(string)
  default     = []
}

variable "key_vault" {
  description = "Key Vault configuration"
  type = object({
    sku_name = string
  })
}

variable "storage" {
  description = "Storage account configuration"
  type = object({
    account_tier             = string
    account_replication_type = string
    min_tls_version          = string
  })
}

variable "storage_container" {
  description = "Storage container configuration"
  type = object({
    name                  = string
    container_access_type = string
  })
}

variable "github_username" {
  description = "GitHub username for container registry"
  type        = string
  sensitive   = false
}

variable "github_token" {
  description = "GitHub personal access token with package read permissions"
  type        = string
  sensitive   = true
}

variable "allowed_origins" {
  description = "CORS allowed origins for storage account"
  type        = list(string)
  default     = []
}

variable "default_admin_email" {
  description = "Email of the default admin user"
  type        = string
  default     = ""
}
