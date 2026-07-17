output "url" {
  description = "The base URL of the Gotenberg conversion service"
  value       = "http://${azurerm_container_group.main.fqdn}:3000"
}

output "basic_auth_username_secret_versionless_id" {
  description = "The versionless ID of the Gotenberg basic auth username secret in Key Vault"
  value       = azurerm_key_vault_secret.gotenberg_basic_auth_username.versionless_id
}

output "basic_auth_password_secret_versionless_id" {
  description = "The versionless ID of the Gotenberg basic auth password secret in Key Vault"
  value       = azurerm_key_vault_secret.gotenberg_basic_auth_password.versionless_id
}
