terraform {
  required_version = "1.11.4"
  backend "azurerm" {}
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "3.117.1"
    }
    azapi = {
      source  = "Azure/azapi"
      version = "1.15.0"
    }
    restapi = {
      source  = "Mastercard/restapi"
      version = "2.0.1"
    }
  }
}

provider "azurerm" {
  features {}
}

provider "azapi" {
  default_tags = module.tags.common_tags
}
