locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project
    CreatedBy   = "IaC"
  }
  project_short = substr(var.project, 0, 15)
  project_short_no_hyphens = replace(local.project_short, "-", "")
  kv_name = "kv-${local.project_short}-${var.environment}"
  st_name = "st${local.project_short_no_hyphens}${var.environment}"
}
