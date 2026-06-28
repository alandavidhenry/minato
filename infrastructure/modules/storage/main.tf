locals {
  location_short = {
    "UK South" = "uks"
    "uksouth"  = "uks"
    "UK West"  = "ukw"
    "ukwest"   = "ukw"
  }[var.location]
  st_name = "st${replace(var.project, "-", "")}${var.environment}${local.location_short}01"
}

resource "azurerm_storage_account" "main" {
  name                     = local.st_name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = var.account_tier
  account_replication_type = var.account_replication_type
  min_tls_version          = var.min_tls_version

  table_encryption_key_type = "Service"

  blob_properties {
    dynamic "cors_rule" {
      for_each = length(var.allowed_origins) > 0 ? [1] : []
      content {
        allowed_headers    = ["*"]
        allowed_methods    = ["GET", "HEAD", "OPTIONS"]
        allowed_origins    = var.allowed_origins
        exposed_headers    = ["*"]
        max_age_in_seconds = 86400
      }
    }
  }

  tags = var.tags
}

resource "azurerm_storage_container" "main" {
  for_each = var.containers

  name                  = each.key
  storage_account_id    = azurerm_storage_account.main.id
  container_access_type = each.value.access_type
}

resource "azurerm_storage_table" "activity_logs" {
  name                 = "activityLogs"
  storage_account_name = azurerm_storage_account.main.name
}
