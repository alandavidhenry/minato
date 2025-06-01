terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.31"
    }
    azurecaf = {
      source  = "aztfmod/azurecaf"
      version = "= 2.0.0-preview3"
    }
  }
  required_version = ">= 1.11.0"
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
  subscription_id = var.subscription_id
}

provider "azurecaf" {}
