# Gotenberg (https://gotenberg.dev) converts uploaded Word documents to PDF
# so uploaded H&S documents can be stored/served as tamper-evident PDFs.
#
# Deployed as a public Azure Container Instance (not VNet-isolated) because
# the App Service Plan is on the Free (F1) SKU, which does not support
# regional VNet integration. The API is locked down with Gotenberg's
# built-in basic auth so the conversion endpoint isn't open to the internet.
# Revisit with private VNet integration if the App Service Plan is ever
# upgraded to Basic (B1) or above.

locals {
  location_short = {
    "UK South" = "uks"
    "uksouth"  = "uks"
    "UK West"  = "ukw"
    "ukwest"   = "ukw"
  }[var.location]
  container_group_name = "aci-${var.project}-${var.environment}-gotenberg-${local.location_short}"
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

resource "azurerm_container_group" "main" {
  name                = local.container_group_name
  location            = var.location
  resource_group_name = var.resource_group_name
  os_type             = "Linux"
  ip_address_type     = "Public"
  dns_name_label      = local.container_group_name
  restart_policy      = "Always"

  container {
    name   = "gotenberg"
    image  = var.image
    cpu    = var.cpu
    memory = var.memory

    # Preserve the image's tini entrypoint (PID 1 signal handling / zombie
    # reaping) while appending the flag that turns on API basic auth.
    commands = ["/usr/bin/tini", "--", "gotenberg", "--api-enable-basic-auth"]

    ports {
      port     = 3000
      protocol = "TCP"
    }

    secure_environment_variables = {
      GOTENBERG_API_BASIC_AUTH_USERNAME = random_password.basic_auth_username.result
      GOTENBERG_API_BASIC_AUTH_PASSWORD = random_password.basic_auth_password.result
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
