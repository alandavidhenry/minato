terraform {
  backend "azurerm" {}
}

module "document_portal" {
  source = "../../modules/document_portal"

  project               = var.project
  environment           = var.environment
  location              = var.location
  app_service_sku       = var.app_service_sku
  https_only            = var.https_only
  redirect_uris         = var.redirect_uris
  key_vault             = var.key_vault
  storage               = var.storage
  storage_container     = var.storage_container
  document_intelligence = var.document_intelligence
  github_username       = var.github_username
  github_token          = var.github_token
  default_admin_email   = var.default_admin_email

  allowed_origins = [
    "http://localhost:3000",
    "https://app-${var.project}-${var.environment}.azurewebsites.net"
  ]
}
