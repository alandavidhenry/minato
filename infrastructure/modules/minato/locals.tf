locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project
    CreatedBy   = "IaC"
  }
  project_short            = substr(var.project, 0, 15)
  project_short_no_hyphens = replace(local.project_short, "-", "")
  location_short = {
    "UK South" = "uks"
    "uksouth"  = "uks"
    "UK West"  = "ukw"
    "ukwest"   = "ukw"
  }[var.location]
  app_service_location_short = {
    "UK South" = "uks"
    "uksouth"  = "uks"
    "UK West"  = "ukw"
    "ukwest"   = "ukw"
  }[var.app_service_location]
  kv_name = "kv-${local.project_short}-${var.environment}-${local.location_short}"
  st_name = "st${local.project_short_no_hyphens}${var.environment}${local.location_short}"
}
