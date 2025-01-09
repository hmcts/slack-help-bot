terraform {
  required_version = "1.10.4"
  backend "azurerm" {}
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "3.117.0"
    }
    azapi = {
      source  = "Azure/azapi"
      version = "1.15.0"
    }
    restapi = {
      source  = "Mastercard/restapi"
      version = "1.20.0"
    }
  }
}

provider "azurerm" {
  features {}
}

provider "azapi" {
  default_tags = module.tags.common_tags
}
