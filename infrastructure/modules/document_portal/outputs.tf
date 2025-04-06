output "resource_group_name" {
  description = "The name of the resource group"
  value       = module.resource_group.resource_group_name
}

output "app_service_name" {
  description = "The name of the App Service"
  value       = module.app_service.app_service_name
}

output "app_service_url" {
  description = "The URL of the App Service"
  value       = module.app_service.app_service_url
}

output "storage_connection_string" {
  description = "Storage account connection string"
  value       = module.storage.primary_connection_string
  sensitive   = true
}

output "storage_container_name" {
  description = "Storage container name"
  value       = var.storage_container.name
}

output "nextauth_secret" {
  description = "NextAuth secret"
  value       = random_password.nextauth_secret.result
  sensitive   = true
}

output "key_vault_name" {
  description = "The name of the Key Vault"
  value       = module.key_vault.key_vault_name
}
