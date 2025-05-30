resource "azurerm_cognitive_deployment" "model" {
  name                 = "gpt-4"
  cognitive_account_id = azapi_resource.AIServices.id
  // region availability https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models#gpt-4-and-gpt-4-turbo-model-availability
  model {
    format  = "OpenAI"
    name    = "gpt-4o"
    version = "2024-11-20"
  }

  scale {
    type     = "Standard"
    capacity = 36
  }

  rai_policy_name = "Microsoft.DefaultV2"
}
