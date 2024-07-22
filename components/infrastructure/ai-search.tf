resource "azurerm_search_service" "this" {
  name                = "platops-slack-help-bot-${var.short_environment}"
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

  tags = local.common_tags
}

resource "azurerm_role_assignment" "identity_access_to_search" {
  principal_id = azurerm_user_assigned_identity.managed_identity.principal_id
  scope        = azurerm_search_service.this.id

  role_definition_name = "Search Index Data Reader"
}

resource "azurerm_role_assignment" "platops_access_to_search" {
  principal_id = data.azuread_group.platops.object_id
  scope        = azurerm_search_service.this.id

  role_definition_name = "Search Index Data Reader"
}
