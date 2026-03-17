resource "azurecaf_name" "storage" {
  name          = var.project
  resource_type = "azurerm_storage_account"
  suffixes      = [var.environment, var.suffix]
}

resource "azurerm_storage_account" "main" {
  name                     = azurecaf_name.storage.result
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

resource "azurerm_storage_table" "users" {
  name                 = "users"
  storage_account_name = azurerm_storage_account.main.name
}
