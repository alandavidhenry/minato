# Gotenberg (https://gotenberg.dev) converts uploaded Word documents to PDF
# so uploaded H&S documents can be stored/served as tamper-evident PDFs.
#
# Deployed as an Azure Container App on the Consumption plan (scales to zero
# between conversions, so idle time isn't billed like a fixed-size ACI was)
# rather than the App Service Plan, because the App Service Plan is on the
# Free (F1) SKU — F1 apps share a subscription-wide 60 CPU-minute/day budget
# per region with every other Free app in that region (the dev and prod app
# services already split that budget), so adding Gotenberg there would
# compete for the same tiny quota instead of getting its own. Container
# Apps' free monthly grant (vCPU-seconds/GiB-seconds/requests) is separate
# from that pool.
#
# Not VNet-isolated for the same reason noted previously: the App Service
# Plan can't do regional VNet integration on F1. The API is locked down with
# Gotenberg's built-in basic auth so the conversion endpoint isn't open to
# the internet. Ingress is still TLS-terminated by the Container Apps
# platform, so traffic is encrypted in transit even though the container
# itself only speaks plain HTTP internally.
# Revisit with VNet-scoped ingress if the App Service Plan is ever upgraded
# to Basic (B1) or above.

locals {
  location_short = {
    "UK South" = "uks"
    "uksouth"  = "uks"
    "UK West"  = "ukw"
    "ukwest"   = "ukw"
  }[var.location]
  name_suffix = "${var.project}-${var.environment}-gotenberg-${local.location_short}"
}

resource "random_password" "basic_auth_username" {
  length      = 16
  special     = false
  min_upper   = 1
  min_lower   = 1
  min_numeric = 1
}

resource "random_password" "basic_auth_password" {
  length           = 32
  special          = true
  override_special = "!@#$%^&*()-_=+"
  min_upper        = 1
  min_lower        = 1
  min_numeric      = 1
  min_special      = 1
}

# Required by azurerm_container_app_environment. Kept to a small daily
# ingestion cap since Gotenberg's own logs are the only thing landing here -
# well within Log Analytics' permanent 5 GB/month free allowance.
resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${local.name_suffix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 0.5
  tags                = var.tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${local.name_suffix}"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = var.tags
}

resource "azurerm_container_app" "main" {
  name                         = "ca-${local.name_suffix}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  secret {
    name  = "basic-auth-username"
    value = random_password.basic_auth_username.result
  }

  secret {
    name  = "basic-auth-password"
    value = random_password.basic_auth_password.result
  }

  template {
    min_replicas = 0
    max_replicas = 1

    container {
      name   = "gotenberg"
      image  = var.image
      cpu    = var.cpu
      memory = var.memory

      # Preserve the image's tini entrypoint (PID 1 signal handling / zombie
      # reaping) while appending the flag that turns on API basic auth.
      command = ["/usr/bin/tini"]
      args    = ["--", "gotenberg", "--api-enable-basic-auth"]

      env {
        name        = "GOTENBERG_API_BASIC_AUTH_USERNAME"
        secret_name = "basic-auth-username"
      }

      env {
        name        = "GOTENBERG_API_BASIC_AUTH_PASSWORD"
        secret_name = "basic-auth-password"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = var.tags
}

resource "azurerm_key_vault_secret" "gotenberg_basic_auth_username" {
  name         = "gotenberg-basic-auth-username"
  value        = random_password.basic_auth_username.result
  key_vault_id = var.key_vault_id
}

resource "azurerm_key_vault_secret" "gotenberg_basic_auth_password" {
  name         = "gotenberg-basic-auth-password"
  value        = random_password.basic_auth_password.result
  key_vault_id = var.key_vault_id
}
