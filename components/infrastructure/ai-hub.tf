// Azure AI Hub
resource "azapi_resource" "hub" {
  type      = "Microsoft.MachineLearningServices/workspaces@2024-04-01-preview"
  name      = "platops-slack-help-bot-hub-${var.env}"
  location  = azurerm_resource_group.this.location
  parent_id = azurerm_resource_group.this.id

  identity {
    type = "SystemAssigned"
  }

  body = jsonencode({
    properties = {
      description    = "Provides AI services to help customers faster"
      friendlyName   = "Slack Help Bot for Platform Operations"
      storageAccount = azurerm_storage_account.default.id
      keyVault       = data.azurerm_key_vault.mgmt_kv.id

      applicationInsights = module.application_insights.id
    }
    kind = "Hub"
  })

  tags = merge(module.tags.common_tags, {
    "__SYSTEM__AIServices_platops-slack-help-bot-ptl"       = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/resourceGroups/${azurerm_resource_group.this.name}/providers/Microsoft.CognitiveServices/accounts/platops-slack-help-bot-ptl",
    "__SYSTEM__AzureOpenAI_platops-slack-help-bot-ptl_aoai" = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/resourceGroups/${azurerm_resource_group.this.name}/providers/Microsoft.CognitiveServices/accounts/platops-slack-help-bot-ptl"
  })
}
