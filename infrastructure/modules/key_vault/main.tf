data "azurerm_client_config" "current" {}

resource "azurecaf_name" "key_vault" {
  name          = var.project
  resource_type = "azurerm_key_vault"
  suffixes      = [var.environment]
}

resource "azurerm_key_vault" "main" {
  name                = azurecaf_name.key_vault.result
  resource_group_name = var.resource_group_name
  location            = var.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = var.sku_name

  # Grant the current user full access to the Key Vault
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Purge", "Recover"
    ]
  }

  tags = var.tags
}

# Store a secret in the key vault
resource "azurerm_key_vault_secret" "secret" {
  for_each = var.secrets

  name         = each.key
  value        = each.value
  key_vault_id = azurerm_key_vault.main.id
}

# Create Key Vault Access Policy
resource "azurerm_key_vault_access_policy" "service_principal" {
  count = length(var.access_policies)

  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = var.access_policies[count.index].object_id

  secret_permissions = var.access_policies[count.index].secret_permissions
}
