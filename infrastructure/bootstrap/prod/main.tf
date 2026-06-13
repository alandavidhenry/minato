terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
  required_version = ">= 1.11.0"
}

variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

provider "azurerm" {
  subscription_id = var.subscription_id
  features {}
}

resource "azurerm_resource_group" "terraform_state" {
  name     = "rg-terraform-state-prod-uks"
  location = "UK South"
}

resource "azurerm_storage_account" "terraform_state" {
  name                     = "tfstateminatoproduks"
  resource_group_name      = azurerm_resource_group.terraform_state.name
  location                 = azurerm_resource_group.terraform_state.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
}

resource "azurerm_storage_container" "terraform_state" {
  name                  = "tfstateprod"
  storage_account_id    = azurerm_storage_account.terraform_state.id
  container_access_type = "private"
}

output "storage_account_name" {
  value = azurerm_storage_account.terraform_state.name
}

output "container_name" {
  value = azurerm_storage_container.terraform_state.name
}
