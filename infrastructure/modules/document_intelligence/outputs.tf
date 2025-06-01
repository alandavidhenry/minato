output "document_intelligence_id" {
  description = "The ID of the Document Intelligence resource"
  value       = azurerm_cognitive_account.document_intelligence.id
}

output "document_intelligence_endpoint" {
  description = "The endpoint of the Document Intelligence resource"
  value       = azurerm_cognitive_account.document_intelligence.endpoint
}

output "document_intelligence_primary_key" {
  description = "The primary access key for the Document Intelligence resource"
  value       = azurerm_cognitive_account.document_intelligence.primary_access_key
  sensitive   = true
}

output "document_intelligence_endpoint_secret_id" {
  description = "The versioned ID of the Document Intelligence endpoint secret"
  value       = azurerm_key_vault_secret.document_intelligence_endpoint.id
}

output "document_intelligence_endpoint_secret_versionless_id" {
  description = "The versionless ID of the Document Intelligence endpoint secret"
  value       = azurerm_key_vault_secret.document_intelligence_endpoint.versionless_id
}

output "document_intelligence_key_secret_id" {
  description = "The versioned ID of the Document Intelligence key secret"
  value       = azurerm_key_vault_secret.document_intelligence_key.id
}

output "document_intelligence_key_secret_versionless_id" {
  description = "The versionless ID of the Document Intelligence key secret"
  value       = azurerm_key_vault_secret.document_intelligence_key.versionless_id
}
