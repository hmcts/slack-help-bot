resource "azurerm_ai_services" "AIServices" {
  name                = "platops-slack-help-bot-${var.env}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name

  identity {
    type = "SystemAssigned"
  }

  custom_subdomain_name = "platops-slack-help-bot-${var.env}"
  public_network_access = "Enabled"

  sku_name = "S0"

  tags = module.tags.common_tags
}

resource "azapi_resource" "AIServicesConnection" {
  type      = "Microsoft.MachineLearningServices/workspaces/connections@2024-04-01-preview"
  name      = "platops-slack-help-bot-${var.env}"
  parent_id = azurerm_machine_learning_workspace.hub.id

  body = {
    properties = {
      category      = "AIServices",
      target        = azurerm_ai_services.AIServices.endpoint,
      authType      = "AAD",
      isSharedToAll = true,
      metadata = {
        ApiType    = "Azure",
        ResourceId = azurerm_ai_services.AIServices.id
      }
    }
  }
  response_export_values = ["*"]
}

removed {
  from = azapi_resource.AIServices
  lifecycle {
    destroy = false
  }
}

import {
  to = azurerm_ai_services.AIServices
  id = "/subscriptions/1baf5470-1c3e-40d3-a6f7-74bfbce4b348/resourceGroups/slack-help-bot-cftptl-intsvc-rg/providers/Microsoft.CognitiveServices/accounts/platops-slack-help-bot-ptl"
}
