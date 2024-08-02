locals {
  help_request_indexer_json = {
    name : "help-requests-indexer",
    dataSourceName : "help-requests",
    targetIndexName : "help-requests",
    schedule : {
      interval : "PT5M",
      startTime : "2024-07-19T15:32:09.422Z"
    },
  }
}

// https://learn.microsoft.com/en-us/rest/api/searchservice/preview-api/create-or-update-indexer
resource "restapi_object" "help_request_indexer" {
  path         = "/indexers"
  query_string = "api-version=2023-10-01-Preview"
  data         = jsonencode(local.help_request_indexer_json)
  id_attribute = "name" # The ID field on the response
  depends_on   = [azurerm_search_service.this, restapi_object.help_request_index, restapi_object.cosmos_datasource]
}
