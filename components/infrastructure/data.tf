data "azurerm_client_config" "current" {
}

data "azurerm_key_vault" "mgmt_kv" {
  name                = var.environment
  resource_group_name = "core-infra-intsvc-rg"
}

