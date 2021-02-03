data "azurerm_client_config" "current" {
}

data "azurerm_key_vault" "mgmt-kv" {
  name                = "cftptl-intsvc"
  resource_group_name = "core-infra-intsvc-rg"
}

