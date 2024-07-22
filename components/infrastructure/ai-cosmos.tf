resource "azurerm_cosmosdb_account" "cosmosdb" {
  name                = "platops-slack-help-bot-${var.short_environment}"
  location            = var.location
  resource_group_name = azurerm_resource_group.this.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"
  tags                = local.common_tags

  free_tier_enabled = true
  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = var.location
    failover_priority = 0
  }

  capacity {
    total_throughput_limit = 1000
  }
}

resource "azurerm_cosmosdb_sql_database" "this" {
  name                = "help-requests"
  resource_group_name = azurerm_resource_group.this.name
  account_name        = azurerm_cosmosdb_account.cosmosdb.name
}

resource "azurerm_cosmosdb_sql_container" "this" {
  name                  = "help-requests"
  resource_group_name   = azurerm_resource_group.this.name
  account_name          = azurerm_cosmosdb_account.cosmosdb.name
  database_name         = azurerm_cosmosdb_sql_database.this.name
  partition_key_paths   = ["/id"]
  partition_key_version = 2

  autoscale_settings {
    max_throughput = 1000
  }

  default_ttl = -1

  indexing_policy {
    indexing_mode = "consistent"
    included_path {
      path = "/*"
    }
  }
}

resource "azurerm_cosmosdb_sql_role_assignment" "identity_contributor" {
  resource_group_name = azurerm_cosmosdb_account.cosmosdb.resource_group_name
  account_name        = azurerm_cosmosdb_account.cosmosdb.name
  # Cosmos DB Built-in Data Contributor
  role_definition_id = "${azurerm_cosmosdb_account.cosmosdb.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id       = azurerm_user_assigned_identity.managed_identity.principal_id
  scope              = azurerm_cosmosdb_account.cosmosdb.id
}

resource "azurerm_cosmosdb_sql_role_assignment" "platops_contributor" {
  resource_group_name = azurerm_cosmosdb_account.cosmosdb.resource_group_name
  account_name        = azurerm_cosmosdb_account.cosmosdb.name
  # Cosmos DB Built-in Data Contributor
  role_definition_id = "${azurerm_cosmosdb_account.cosmosdb.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id       = data.azuread_group.platops.object_id
  scope              = azurerm_cosmosdb_account.cosmosdb.id
}

// work around: https://github.com/hashicorp/terraform-provider-azurerm/issues/21171#issuecomment-1491478301
data "azurerm_search_service" "this" {
  name                = azurerm_search_service.this.name
  resource_group_name = azurerm_search_service.this.resource_group_name
}

resource "azurerm_cosmosdb_sql_role_assignment" "search_service_reader" {
  resource_group_name = azurerm_cosmosdb_account.cosmosdb.resource_group_name
  account_name        = azurerm_cosmosdb_account.cosmosdb.name
  # Cosmos DB Built-in Data Reader
  role_definition_id = "${azurerm_cosmosdb_account.cosmosdb.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000001"
  principal_id       = data.azurerm_search_service.this.identity[0].principal_id
  scope              = azurerm_cosmosdb_account.cosmosdb.id
}

resource "azurerm_role_assignment" "search_search_reader" {
  principal_id = data.azurerm_search_service.this.identity[0].principal_id
  scope        = azurerm_cosmosdb_account.cosmosdb.id

  role_definition_name = "Cosmos DB Account Reader Role"
}
