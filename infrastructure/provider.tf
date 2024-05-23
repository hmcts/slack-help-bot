terraform {
  required_version = "~> 1.5.4"
  backend "azurerm" {}
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "3.104.2"
    }
  }
}

provider "azurerm" {
  features {}
}
