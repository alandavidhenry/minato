terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.23"
    }
    azurecaf = {
      source  = "aztfmod/azurecaf"
      version = "= 2.0.0-preview3"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}
