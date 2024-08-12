terraform {
  required_version = "1.9.2"
  backend "azurerm" {}
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "3.115.0"
    }
    azapi = {
      source  = "Azure/azapi"
      version = "1.14.0"
    }
    restapi = {
      source  = "Mastercard/restapi"
      version = "1.19.1"
    }
  }
}

provider "azurerm" {
  features {}
}

provider "azapi" {
  default_tags = local.common_tags
}
