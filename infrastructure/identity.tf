resource "azurerm_user_assigned_identity" "managed_identity" {
  resource_group_name = "managed-identities-${var.environment}-rg"
  location            = var.location

  name = "${var.product}-${var.environment}-mi"

  tags = local.common_tags
}

resource "azurerm_key_vault_access_policy" "implicit_managed_identity_access_policy" {
  key_vault_id = data.azurerm_key_vault.mgmt-kv.id

  object_id = azurerm_user_assigned_identity.managed_identity.principal_id
  tenant_id = data.azurerm_client_config.current.tenant_id

  key_permissions = [
    "get",
    "list",
  ]

  certificate_permissions = [
    "get",
    "list",
  ]

  secret_permissions = [
    "get",
    "list",
  ]
}