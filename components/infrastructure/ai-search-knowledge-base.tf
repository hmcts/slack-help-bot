locals {
  hmcts_way_knowledge_source_name = "the-hmcts-way-knowledge-source"
  platform_knowledge_base_name    = "hmcts-platform-knowledge"

  hmcts_way_knowledge_source_json = {
    name        = local.hmcts_way_knowledge_source_name
    description = "HMCTS platform documentation indexed from hmcts.github.io."
    kind        = "searchIndex"
    searchIndexParameters = {
      searchIndexName           = "the-hmcts-way"
      semanticConfigurationName = "the-hmcts-way"
      sourceDataFields = [
        { name = "id" },
        { name = "title" },
        { name = "metadata_storage_path" },
        { name = "content" },
      ]
    }
  }

  platform_knowledge_base_json = {
    name = local.platform_knowledge_base_name
    knowledgeSources = [
      { name = local.hmcts_way_knowledge_source_name },
    ]
    models = [
      {
        kind = "azureOpenAI"
        azureOpenAIParameters = {
          resourceUri  = "https://${azurerm_ai_services.AIServices.name}.openai.azure.com/"
          deploymentId = azurerm_cognitive_deployment.model.name
          modelName     = azurerm_cognitive_deployment.model.model[0].name
        }
      },
    ]
    outputMode               = "answerSynthesis"
    retrievalReasoningEffort = { kind = "low" }
    answerInstructions       = "Answer only from the retrieved HMCTS documentation. Be concise and practical. If the documentation does not contain the answer, say that you could not find it. Do not add a sources section because the calling application renders the source links."
  }
}

# Answer synthesis and conversational retrieval currently require the preview API.
resource "restapi_object" "hmcts_way_knowledge_source" {
  path                    = "/knowledgesources"
  read_path               = "/knowledgesources('{id}')"
  update_path             = "/knowledgesources('{id}')"
  destroy_path            = "/knowledgesources('{id}')"
  query_string            = "api-version=2026-08-01-preview"
  data                    = jsonencode(local.hmcts_way_knowledge_source_json)
  id_attribute            = "name"
  ignore_server_additions = true

  depends_on = [restapi_object.hmcts_way_index]
}

resource "restapi_object" "platform_knowledge_base" {
  path                    = "/knowledgebases"
  read_path               = "/knowledgebases('{id}')"
  update_path             = "/knowledgebases('{id}')"
  destroy_path            = "/knowledgebases('{id}')"
  query_string            = "api-version=2026-08-01-preview"
  data                    = jsonencode(local.platform_knowledge_base_json)
  id_attribute            = "name"
  ignore_server_additions = true

  depends_on = [
    restapi_object.hmcts_way_knowledge_source,
    azurerm_role_assignment.search_identity_access_to_ai_services,
  ]
}
