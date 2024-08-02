locals {
  hmcts_way_indexer_json = {
    name : "the-hmcts-way",
    dataSourceName : "the-hmcts-way",
    targetIndexName : "the-hmcts-way",
  }
}

// https://learn.microsoft.com/en-us/rest/api/searchservice/preview-api/create-or-update-indexer
resource "restapi_object" "hmcts_way_indexer" {
  path         = "/indexers"
  query_string = "api-version=2023-10-01-Preview"
  data         = jsonencode(local.hmcts_way_indexer_json)
  id_attribute = "name" # The ID field on the response
  depends_on   = [azurerm_search_service.this, restapi_object.hmcts_way_index, restapi_object.storage_account_datasource]
}
