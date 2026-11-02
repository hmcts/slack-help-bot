resource "azurerm_search_service" "feepay" {
  name                = "ccpay-feepay-help-${var.env}"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  sku                 = "basic"
  replica_count       = 1
  partition_count     = 1

  local_authentication_enabled = true
  authentication_failure_mode  = "http403"
  semantic_search_sku          = "standard"

  identity {
    type = "SystemAssigned"
  }

  tags = module.tags.common_tags
}

resource "azurerm_user_assigned_identity" "github_sync" {
  name                = "${var.product}-${var.long_environment}-sync-mi"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location

  tags = module.tags.common_tags
}

resource "azurerm_federated_identity_credential" "github_sync" {
  name                = "sync-knowledge-${var.github_branch}"
  resource_group_name = azurerm_user_assigned_identity.github_sync.resource_group_name
  parent_id           = azurerm_user_assigned_identity.github_sync.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = "https://token.actions.githubusercontent.com"
  subject             = "repo:${var.github_repository}:ref:refs/heads/${var.github_branch}"
}

resource "azurerm_role_assignment" "github_sync_service_contributor" {
  scope                = azurerm_search_service.feepay.id
  role_definition_name = "Search Service Contributor"
  principal_id         = azurerm_user_assigned_identity.github_sync.principal_id
}

resource "azurerm_role_assignment" "github_sync_data_contributor" {
  scope                = azurerm_search_service.feepay.id
  role_definition_name = "Search Index Data Contributor"
  principal_id         = azurerm_user_assigned_identity.github_sync.principal_id
}

resource "azurerm_key_vault_access_policy" "github_sync_secrets_reader" {
  key_vault_id = data.azurerm_key_vault.mgmt_kv.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_user_assigned_identity.github_sync.principal_id

  secret_permissions = ["Get"]
}
