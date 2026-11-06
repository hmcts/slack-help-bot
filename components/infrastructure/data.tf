data "azurerm_client_config" "current" {}

data "azurerm_key_vault" "mgmt_kv" {
  name                = var.long_environment
  resource_group_name = "core-infra-intsvc-rg"
}

data "azurerm_user_assigned_identity" "bot" {
  name                = "slack-help-bot-${var.long_environment}-mi"
  resource_group_name = "managed-identities-${var.long_environment}-rg"
}
