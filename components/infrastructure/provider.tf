terraform {
  required_version = "1.13.2"
  backend "azurerm" {}
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "4.41.0"
    }
    azapi = {
      source  = "Azure/azapi"
      version = "2.10.0"
    }
    restapi = {
      source  = "Mastercard/restapi"
      version = "3.0.0"
    }
  }
}

provider "azurerm" {
  features {}
}

provider "azapi" {
  default_tags = module.tags.common_tags
}
