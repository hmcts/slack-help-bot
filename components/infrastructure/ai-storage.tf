resource "azurerm_storage_account" "default" {
  name                            = "platopslackhelpbotai"
  location                        = azurerm_resource_group.this.location
  resource_group_name             = azurerm_resource_group.this.name
  account_tier                    = "Standard"
  account_replication_type        = "ZRS"
  allow_nested_items_to_be_public = false

  blob_properties {
    delete_retention_policy {
      days = 7
    }
    container_delete_retention_policy {
      days = 7
    }
  }

  tags = module.tags.common_tags
}

resource "azurerm_storage_container" "hmcts_way" {
  name                 = "the-hmcts-way"
  storage_account_name = azurerm_storage_account.default.name
}

resource "azurerm_role_assignment" "storage_blob_data_reader_search_service" {
  principal_id = data.azurerm_search_service.this.identity[0].principal_id
  scope        = azurerm_storage_account.default.id

  role_definition_name = "Storage Blob Data Reader"
}

resource "azurerm_role_assignment" "storage_blob_data_contributor_platops" {
  principal_id = data.azuread_group.platops.object_id
  scope        = azurerm_storage_account.default.id

  role_definition_name = "Storage Blob Data Contributor"
}

data "azuread_service_principal" "hmcts_way_repo" {
  display_name = "DTS HMCTS way indexer"
}

resource "azurerm_role_assignment" "storage_blob_data_contributor_hmcts_way" {
  principal_id = data.azuread_service_principal.hmcts_way_repo.id
  scope        = azurerm_storage_account.default.id

  role_definition_name = "Storage Blob Data Contributor"
}


