module "minato" {
  source = "../../modules/minato"

  project            = var.project
  environment        = var.environment
  location           = var.location
  app_service_sku    = var.app_service_sku
  https_only         = var.https_only
  key_vault          = var.key_vault
  storage            = var.storage
  storage_container  = var.storage_container
  github_username    = var.github_username
  github_token       = var.github_token
  extra_app_settings = var.extra_app_settings
  database_url       = var.database_url

  allowed_origins = [
    "https://app-${var.project}-${var.environment}-uks.azurewebsites.net",
  ]
}
