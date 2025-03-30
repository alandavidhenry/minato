terraform {
  backend "azurerm" {}
}

module "document_portal" {
  source = "../../modules/document_portal"

  project           = var.project
  environment       = var.environment
  location          = var.location
  app_service_sku   = var.app_service_sku
  https_only        = var.https_only
  redirect_uris     = var.redirect_uris
  key_vault         = var.key_vault
  storage           = var.storage
  storage_container = var.storage_container
  azure_ad          = var.azure_ad
  github_username   = var.github_username
  github_token      = var.github_token

  allowed_origins = [
    "https://app-${var.project}-${var.environment}.azurewebsites.net",
  ]
}
