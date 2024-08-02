locals {
  hmcts_way_datasource_json = {
    name : "the-hmcts-way",
    description : "HTML content from The HMCTS Way documentation",
    type : "azureblob",
    credentials : {
      connectionString : "ResourceId=${azurerm_storage_account.default.id};"
    },
    container : {
      name : "the-hmcts-way",
    },
    dataDeletionDetectionPolicy : {
      "@odata.type" : "#Microsoft.Azure.Search.NativeBlobSoftDeleteDeletionDetectionPolicy",
    },
  }
}

# https://learn.microsoft.com/en-us/rest/api/searchservice/create-data-source
resource "restapi_object" "storage_account_datasource" {
  path         = "/datasources"
  query_string = "api-version=2023-10-01-Preview"
  data         = jsonencode(local.hmcts_way_datasource_json)
  id_attribute = "name" # The ID field on the response
  depends_on = [
    azurerm_search_service.this, azurerm_role_assignment.search_search_reader,
    azurerm_role_assignment.storage_blob_data_reader_search_service
  ]
}
