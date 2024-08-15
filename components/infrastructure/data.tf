data "azurerm_client_config" "current" {
}

data "azurerm_key_vault" "mgmt_kv" {
  name                = var.long_environment
  resource_group_name = "core-infra-intsvc-rg"
}

