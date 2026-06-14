terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    azurecaf = {
      source  = "aztfmod/azurecaf"
      version = "= 2.0.0-preview3"
    }
  }
  required_version = ">= 1.15.0"

  backend "azurerm" {
    resource_group_name  = "rg-terraform-state-prod-uks"
    storage_account_name = "tfstateminatoproduks"
    container_name       = "tfstateprod"
    key                  = "minato-prod.tfstate"
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

provider "azurecaf" {}
