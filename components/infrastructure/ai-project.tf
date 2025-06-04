resource "azurerm_ai_foundry_project" "project" {
  name                = "platops-slack-help-bot-${var.env}"
  location            = azurerm_resource_group.this.location

  identity {
    type = "SystemAssigned"
  }

  description        = "AI for helping customers faster"
  friendly_name      = "Slack help bot - Platform Operations"
  ai_services_hub_id = azurerm_machine_learning_workspace.hub.id
}

removed {
  from = azapi_resource.project
  lifecycle {
    destroy = false
  }
}

import {
  to = azurerm_ai_foundry_project.project
  id = "/subscriptions/1baf5470-1c3e-40d3-a6f7-74bfbce4b348/resourceGroups/slack-help-bot-cftptl-intsvc-rg/providers/Microsoft.MachineLearningServices/workspaces/platops-slack-help-bot-ptl"
}