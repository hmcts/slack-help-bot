locals {
  datasource_json = {
    name : "help-requests",
    description : "PlatOps help requests",
    type : "cosmosdb",
    credentials : {
      connectionString : "ResourceId=${azurerm_cosmosdb_account.cosmosdb.id};Database=help-requests;IdentityAuthType=AccessToken"
    },
    container : {
      name : "help-requests",
      query : "SELECT * FROM c WHERE c._ts >= @HighWaterMark ORDER BY c._ts"
    },
    dataChangeDetectionPolicy : {
      "@odata.type" : "#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy",
      highWaterMarkColumnName : "_ts"
    },
  }
}

# https://learn.microsoft.com/en-us/rest/api/searchservice/create-data-source
resource "restapi_object" "search_datasource" {
  path         = "/datasources"
  query_string = "api-version=2023-10-01-Preview"
  data         = jsonencode(local.datasource_json)
  id_attribute = "name" # The ID field on the response
  depends_on = [
    azurerm_search_service.this, azurerm_role_assignment.search_search_reader,
    azurerm_cosmosdb_sql_role_assignment.search_service_reader
  ]
}
