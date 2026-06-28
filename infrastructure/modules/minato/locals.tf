locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project
    CreatedBy   = "IaC"
  }
  app_service_location_short = {
    "UK South" = "uks"
    "uksouth"  = "uks"
    "UK West"  = "ukw"
    "ukwest"   = "ukw"
  }[var.app_service_location]
}
