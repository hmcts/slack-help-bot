resource "azurerm_cognitive_deployment" "model" {
  name                 = "gpt-4"
  cognitive_account_id = azapi_resource.AIServices.id
  model {
    format  = "OpenAI"
    name    = "gpt-4"
    version = "0125-Preview"
  }

  scale {
    type     = "Standard"
    capacity = 36
  }

  rai_policy_name = "Microsoft.DefaultV2"
}
