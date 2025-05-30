resource "azapi_resource" "AIServices" {
  type      = "Microsoft.CognitiveServices/accounts@2023-10-01-preview"
  name      = "platops-slack-help-bot-${var.env}"
  location  = azurerm_resource_group.this.location
  parent_id = azurerm_resource_group.this.id

  identity {
    type = "SystemAssigned"
  }

  body = jsonencode({
    name = "platops-slack-help-bot-${var.env}"

    properties = {
      customSubDomainName = "platops-slack-help-bot-${var.env}",
      publicNetworkAccess = "Enabled",
    }
    kind = "AIServices"
    sku = {
      // https://learn.microsoft.com/en-us/azure/analysis-services/analysis-services-overview#europe
      name = "S0"
    }
  })

  response_export_values = ["*"]

  tags = module.tags.common_tags
}

resource "azapi_resource" "AIServicesConnection" {
  type      = "Microsoft.MachineLearningServices/workspaces/connections@2024-04-01-preview"
  name      = "platops-slack-help-bot-${var.env}"
  parent_id = azapi_resource.hub.id

  body = jsonencode({
    properties = {
      category            = "AIServices",
      target              = jsondecode(azapi_resource.AIServices.output).properties.endpoint,
      authType            = "AAD",
      isSharedToAll       = true,
      metadata = {
        ApiType    = "Azure",
        ResourceId = azapi_resource.AIServices.id
      }
    }
  })
  response_export_values = ["*"]
}
