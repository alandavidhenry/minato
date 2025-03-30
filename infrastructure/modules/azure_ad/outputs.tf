output "application_id" {
  description = "The Application (Client) ID"
  value       = azuread_application.main.client_id
}

output "application_object_id" {
  description = "The Application Object ID"
  value       = azuread_application.main.object_id
}

output "service_principal_id" {
  description = "The Service Principal ID"
  value       = azuread_service_principal.main.id
}

output "client_secret" {
  description = "The Application Client Secret"
  value       = azuread_application_password.main.value
  sensitive   = true
}
