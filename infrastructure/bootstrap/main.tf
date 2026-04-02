# bootstrap/main.tf
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "terraform_state" {
  name     = "rg-terraform-state"
  location = "UK South"
}

resource "azurerm_storage_account" "terraform_state" {
  name                     = "tfstate${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.terraform_state.name
  location                 = azurerm_resource_group.terraform_state.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
}

resource "azurerm_storage_container" "terraform_state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.terraform_state.id
  container_access_type = "private"
}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

output "storage_account_name" {
  value = azurerm_storage_account.terraform_state.name
}

output "container_name" {
  value = azurerm_storage_container.terraform_state.name
}
