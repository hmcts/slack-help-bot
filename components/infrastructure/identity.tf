resource "azurerm_user_assigned_identity" "managed_identity" {
  resource_group_name = "managed-identities-${var.long_environment}-rg"
  location            = var.location

  name = "${var.product}-${var.long_environment}-mi"

  tags = module.tags.common_tags
}

resource "azurerm_key_vault_access_policy" "implicit_managed_identity_access_policy" {
  key_vault_id = data.azurerm_key_vault.mgmt_kv.id

  object_id = azurerm_user_assigned_identity.managed_identity.principal_id
  tenant_id = data.azurerm_client_config.current.tenant_id

  key_permissions = [
    "Get",
    "List",
  ]

  certificate_permissions = [
    "Get",
    "List",
  ]

  secret_permissions = [
    "Get",
    "List",
  ]
}