resource "azurecaf_name" "document_intelligence" {
  name          = var.project
  resource_type = "azurerm_cognitive_account"
  suffixes      = [var.environment]
}

resource "azurerm_cognitive_account" "document_intelligence" {
  name                = azurecaf_name.document_intelligence.result
  location            = var.location
  resource_group_name = var.resource_group_name
  kind                = "FormRecognizer"
  sku_name            = var.sku_name
  tags                = var.tags
}

resource "azurerm_key_vault_secret" "document_intelligence_endpoint" {
  name         = "document-intelligence-endpoint"
  value        = azurerm_cognitive_account.document_intelligence.endpoint
  key_vault_id = var.key_vault_id
}

resource "azurerm_key_vault_secret" "document_intelligence_key" {
  name         = "document-intelligence-key"
  value        = azurerm_cognitive_account.document_intelligence.primary_access_key
  key_vault_id = var.key_vault_id
  content_type = "text/plain"
}
