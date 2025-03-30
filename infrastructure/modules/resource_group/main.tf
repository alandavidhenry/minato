resource "azurecaf_name" "rg" {
  name          = var.project
  resource_type = "azurerm_resource_group"
  suffixes      = [var.environment]
}

resource "azurerm_resource_group" "main" {
  name     = coalesce(var.resource_group_name, azurecaf_name.rg.result)
  location = var.location
  tags     = var.tags
}
