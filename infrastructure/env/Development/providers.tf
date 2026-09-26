terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.14"
    }
  }
  required_version = ">= 1.16.0"

  backend "azurerm" {
    resource_group_name  = "rg-terraform-state-dev-uks"
    storage_account_name = "tfstateminatodevuks"
    container_name       = "tfstatedev"
    key                  = "minato-dev.tfstate"
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
}
