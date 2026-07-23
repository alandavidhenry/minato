# Azure Database for PostgreSQL — Flexible Server.
#
# SCAFFOLDED BUT NOT WIRED IN. This module is not referenced by
# `modules/minato/main.tf` — provisioning it costs nothing until it's added
# there. The app itself needs no code changes to switch: `src/lib/prisma.ts`
# connects via `@prisma/adapter-pg` (standard `node-postgres`) using only
# `DATABASE_URL`, and Flexible Server speaks the same wire protocol as the
# Neon connection string currently in use. Cutting over is: apply this
# module, copy its `connection_string_secret_versionless_id` output into the
# `DATABASE_URL` app setting in `modules/minato/main.tf` in place of the
# existing `azurerm_key_vault_secret.database_url` reference, run
# `prisma migrate deploy` against the new server, apply.
#
# Exists as a paid backup/scale-up path alongside the free Neon tier — see
# "Free Tier Architecture" in future-considerations.md. Suitable for scaling
# beyond Neon's free compute-hour quota: Burstable/General Purpose/Memory
# Optimized tiers all the way up to dozens of vCores, read replicas, and
# zone-redundant HA, without changing anything else about the app.
#
# Like Gotenberg, this is not VNet-isolated: the App Service Plan is on the
# Free (F1) SKU, which doesn't support regional VNet integration, so the
# server is reachable over the public internet (TLS-enforced) and locked
# down to Azure-originated traffic via the firewall rule below instead.
# Revisit with VNet-scoped private access if the App Service Plan is ever
# upgraded to Basic (B1) or above.

locals {
  location_short = {
    "UK South" = "uks"
    "uksouth"  = "uks"
    "UK West"  = "ukw"
    "ukwest"   = "ukw"
  }[var.location]
  name_suffix = "${var.project}-${var.environment}-psql-${local.location_short}"
}

resource "random_password" "administrator_password" {
  length  = 32
  special = true
  # Restricted to characters that are safe unescaped in a connection-string
  # URL alongside `urlencode()` — avoids `/? etc.
  override_special = "-_=+"
  min_upper        = 1
  min_lower        = 1
  min_numeric      = 1
  min_special      = 1
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                = "psql-${local.name_suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location

  version                      = var.postgres_version
  administrator_login          = var.administrator_login
  administrator_password       = random_password.administrator_password.result
  storage_mb                   = var.storage_mb
  sku_name                     = var.sku_name
  backup_retention_days        = var.backup_retention_days
  geo_redundant_backup_enabled = var.geo_redundant_backup_enabled

  dynamic "high_availability" {
    for_each = var.zone_redundant_ha_enabled ? [1] : []
    content {
      mode = "ZoneRedundant"
    }
  }

  tags = var.tags

  lifecycle {
    # Azure assigns the zone at creation; ignore drift so plans stay quiet
    # when Terraform wasn't the one that changed it.
    ignore_changes = [zone]
  }
}

# Azure represents "allow every Azure-hosted resource, not just one IP" as
# the literal range 0.0.0.0-0.0.0.0 rather than a real address block.
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = var.database_name
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "UTF8"
}

resource "azurerm_key_vault_secret" "connection_string" {
  name         = "postgres-flexible-server-database-url"
  value        = "postgresql://${var.administrator_login}:${urlencode(random_password.administrator_password.result)}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.database_name}?sslmode=require"
  key_vault_id = var.key_vault_id
}
