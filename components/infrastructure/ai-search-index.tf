provider "restapi" {
  uri                  = "https://${azurerm_search_service.this.name}.search.windows.net"
  write_returns_object = true
  debug                = true

  headers = {
    "api-key"      = azurerm_search_service.this.primary_key,
    "Content-Type" = "application/json"
  }
}

locals {
  index_json = {
    name = "help-requests"
    fields = [
      {
        name       = "id"
        type       = "Edm.String"
        searchable = false
        filterable = false
        sortable   = false
      },
      {
        name        = "created_at"
        type        = "Edm.DateTimeOffset"
        searchable  = false
        filterable  = true
        sortable    = true
        retrievable = true
      },
      {
        name       = "key"
        type       = "Edm.String"
        key        = true
        searchable = false
        filterable = false
        sortable   = false
      },
      {
        name       = "status"
        type       = "Edm.String"
        searchable = false
        filterable = false
        sortable   = false
      },
      {
        name       = "title"
        type       = "Edm.String"
        searchable = true
        filterable = true
        sortable   = true
      },
      {
        name       = "description"
        type       = "Edm.String"
        searchable = true
        filterable = true
        sortable   = true
      },
      {
        name       = "analysis"
        type       = "Edm.String"
        searchable = true
        filterable = true
        sortable   = true
      },
      {
        name       = "rid"
        type       = "Edm.String"
        searchable = false
        filterable = false
        sortable   = false
      },
      {
        name       = "url"
        type       = "Edm.String"
        searchable = false
        filterable = false
        sortable   = false
      },
    ],
    semantic = {
      configurations = [
        {
          name : "help-requests",
          prioritizedFields = {
            titleField = {
              fieldName = "title"
            },
            prioritizedContentFields = [
              {
                fieldName = "description"
              },
              {
                fieldName = "analysis"
              }
            ],
            prioritizedKeywordsFields = []
          }
        }
      ]
    },

  }
}


# To do this: https://learn.microsoft.com/en-us/rest/api/searchservice/preview-api/create-or-update-index
resource "restapi_object" "help_request_index" {
  path         = "/indexes"
  query_string = "api-version=2023-10-01-Preview"
  data         = jsonencode(local.index_json)
  id_attribute = "name" # The ID field on the response
}
