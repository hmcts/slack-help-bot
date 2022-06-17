terraform {
  required_version = "~> 1.2.0"
  backend "azurerm" {}
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "2.99.0"
    }
  }
}

provider "azurerm" {
  features {}
}