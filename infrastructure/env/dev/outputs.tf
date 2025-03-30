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

output "application_id" {
  description = "The Application (Client) ID for Azure AD"
  value       = module.document_portal.application_id
  sensitive   = false
}

output "client_secret" {
  description = "The Application Client Secret"
  value       = module.document_portal.client_secret
  sensitive   = true
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

output "tenant_id" {
  description = "Azure AD tenant ID"
  value       = module.document_portal.tenant_id
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
