resource "azurerm_cognitive_deployment" "model" {
  name                 = "gpt-4"
  cognitive_account_id = azurerm_ai_services.AIServices.id
  // region availability https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models#gpt-4-and-gpt-4-turbo-model-availability
  model {
    format  = "OpenAI"
    name    = "gpt-4o"
    version = "2024-11-20"

  }

  sku {
    name     = "Standard"
    capacity = 36
  }

  rai_policy_name = "Microsoft.DefaultV2"
}

resource "azurerm_cognitive_deployment" "embedding" {
  name                 = "text-embedding-3-small"
  cognitive_account_id = azurerm_ai_services.AIServices.id
  model {
    format  = "OpenAI"
    name    = "text-embedding-3-small"
    version = "1"
  }

  sku {
    name     = "Standard"
    capacity = 36
  }

  rai_policy_name = "Microsoft.DefaultV2"
}
