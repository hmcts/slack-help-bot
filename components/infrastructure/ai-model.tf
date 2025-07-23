resource "azurerm_cognitive_deployment" "model" {
  name                 = "gpt-4.1"
  cognitive_account_id = azurerm_ai_services.AIServices.id
  // region availability https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models#gpt-4-and-gpt-4-turbo-model-availability
  model {
    format  = "OpenAI"
    name    = "gpt-4.1"
    version = "2025-04-14"
  }

  sku {
    name     = "gpt-4.1"
    capacity = 36
  }

  rai_policy_name = "gpt-4.1"
}
