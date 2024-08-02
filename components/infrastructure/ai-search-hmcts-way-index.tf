locals {
  hmcts_way_index_json = {
    name = "the-hmcts-way"
    fields = [
      {
        name       = "id"
        type       = "Edm.String"
        searchable = false
        filterable = false
        sortable   = false
      },
      {
        name       = "metadata_storage_last_modified"
        type       = "Edm.DateTimeOffset"
        searchable = false
        filterable = true
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
        name       = "metadata_storage_name"
        type       = "Edm.String"
        searchable = true
        filterable = true
        sortable   = true
      },
      {
        name       = "metadata_storage_path"
        type       = "Edm.String"
        searchable = true
        filterable = true
        sortable   = true
        key        = true
      },
      {
        name       = "metadata_storage_content_md5"
        type       = "Edm.String"
        filterable = true
        sortable   = true
      },
      {
        name       = "content"
        type       = "Edm.String"
        searchable = true
        filterable = false
        sortable   = true
      },
    ],
    semantic = {
      configurations = [
        {
          name : "the-hmcts-way",
          prioritizedFields = {
            titleField = {
              fieldName = "title"
            },
            prioritizedContentFields = [
              {
                fieldName = "content"
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
resource "restapi_object" "hmcts_way_index" {
  path         = "/indexes"
  query_string = "api-version=2023-10-01-Preview"
  data         = jsonencode(local.hmcts_way_index_json)
  id_attribute = "name" # The ID field on the response
}
