terraform {
  required_version = "~> 0.15.0"
  backend "azurerm" {}
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "2.45.0"
    }
  }
}

provider "azurerm" {
  features {}
}