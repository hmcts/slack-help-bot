// Azure AI Hub
resource "azurerm_machine_learning_workspace" "hub" {
  name                = "platops-slack-help-bot-hub-${var.env}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name

  identity {
    type = "SystemAssigned"
  }

  description             = "Provides AI services to help customers faster"
  friendly_name           = "Slack Help Bot for Platform Operations"
  key_vault_id            = data.azurerm_key_vault.mgmt_kv.id
  application_insights_id = module.application_insights.id
  storage_account_id      = azurerm_storage_account.default.id

  tags = module.tags.common_tags

  lifecycle {
    // AI Studio adds system tags automatically that will case unwanted diffs
    ignore_changes = [tags]
  }
}

removed {
  from = azapi_resource.hub
  lifecycle {
    destroy = false
  }
}

import {
  to = azurerm_machine_learning_workspace.hub
  id = "/subscriptions/1baf5470-1c3e-40d3-a6f7-74bfbce4b348/resourceGroups/slack-help-bot-cftptl-intsvc-rg/providers/Microsoft.MachineLearningServices/workspaces/platops-slack-help-bot-hub-ptl"
}