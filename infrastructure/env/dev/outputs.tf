output "resource_group_name" {
  description = "The name of the resource group"
  value       = module.document_portal.resource_group_name
}

output "app_service_name" {
  description = "The name of the App Service"
  value       = module.document_portal.app_service_name
}

output "app_service_url" {
  description = "The URL of the App Service"
  value       = module.document_portal.app_service_url
}

output "storage_connection_string" {
  description = "Storage account connection string"
  value       = module.document_portal.storage_connection_string
  sensitive   = true
}

output "storage_container_name" {
  description = "Storage container name"
  value       = module.document_portal.storage_container_name
}

output "nextauth_secret" {
  description = "NextAuth secret"
  value       = module.document_portal.nextauth_secret
  sensitive   = true
}

output "key_vault_name" {
  description = "The name of the Key Vault"
  value       = module.document_portal.key_vault_name
}

output "document_intelligence_endpoint" {
  description = "The endpoint of the Document Intelligence service"
  value       = module.document_portal.document_intelligence_endpoint
}

output "document_intelligence_key" {
  description = "The primary key of the Document Intelligence service"
  value       = module.document_portal.document_intelligence_key
  sensitive   = true
}
