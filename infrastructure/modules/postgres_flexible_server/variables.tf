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
  description = "The ID of the Key Vault to store the generated database connection string"
  type        = string
}

variable "postgres_version" {
  description = "PostgreSQL major version"
  type        = string
  default     = "16"
}

variable "sku_name" {
  description = "Compute tier/size, e.g. \"B_Standard_B1ms\" (Burstable, cheapest — good Neon-equivalent starting point), \"GP_Standard_D2s_v3\" (General Purpose), \"MO_Standard_E4s_v3\" (Memory Optimized). Change and re-apply to scale up/down."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "storage_mb" {
  description = "Allocated storage in MB (32768 = 32 GB is the platform minimum)"
  type        = number
  default     = 32768
}

variable "backup_retention_days" {
  description = "Number of days to retain automated backups (7-35)"
  type        = number
  default     = 7
}

variable "geo_redundant_backup_enabled" {
  description = "Whether backups are also copied to the paired region (extra cost — leave off until actually needed)"
  type        = bool
  default     = false
}

variable "zone_redundant_ha_enabled" {
  description = "Whether to run a synchronously-replicated standby in a second availability zone (roughly doubles compute cost — leave off until uptime requirements justify it)"
  type        = bool
  default     = false
}

variable "administrator_login" {
  description = "PostgreSQL administrator username"
  type        = string
  default     = "psqladmin"
}

variable "database_name" {
  description = "Name of the application database created on the server"
  type        = string
  default     = "minato"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
