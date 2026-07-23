output "fqdn" {
  description = "The fully qualified domain name of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "database_name" {
  description = "The name of the application database on the server"
  value       = azurerm_postgresql_flexible_server_database.main.name
}

output "administrator_login" {
  description = "The PostgreSQL administrator username"
  value       = azurerm_postgresql_flexible_server.main.administrator_login
}

output "connection_string_secret_versionless_id" {
  description = "The versionless ID of the DATABASE_URL-shaped connection string stored in Key Vault"
  value       = azurerm_key_vault_secret.connection_string.versionless_id
}
