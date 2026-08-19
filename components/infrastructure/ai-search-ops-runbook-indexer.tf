locals {
  ops_runbook_indexer_json = {
    name : "ops-runbook",
    dataSourceName : "ops-runbook",
    targetIndexName : "ops-runbook",
    parameters : {
      configuration : {
        indexedFileNameExtensions : ".html",
        imageAction : "none"
      }
    }
  }
}

// https://learn.microsoft.com/en-us/rest/api/searchservice/preview-api/create-or-update-indexer
resource "restapi_object" "ops_runbook_indexer" {
  path         = "/indexers"
  query_string = "api-version=2023-10-01-Preview"
  data         = jsonencode(local.ops_runbook_indexer_json)
  id_attribute = "name" # The ID field on the response
  depends_on   = [azurerm_search_service.this, restapi_object.ops_runbook_index, restapi_object.storage_account_datasource_ops_runbook]
}

resource "azurerm_role_assignment" "search_contributor_ops_runbook" {
  principal_id = data.azuread_service_principal.ops_runbook_repo.object_id
  scope        = azurerm_search_service.this.id

  role_definition_name = "Search Service Contributor"
}
