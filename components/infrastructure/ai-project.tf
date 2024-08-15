resource "azapi_resource" "project" {
  type      = "Microsoft.MachineLearningServices/workspaces@2024-04-01-preview"
  name      = "platops-slack-help-bot-${var.env}"
  location  = azurerm_resource_group.this.location
  parent_id = azurerm_resource_group.this.id

  identity {
    type = "SystemAssigned"
  }

  body = jsonencode({
    properties = {
      description   = "AI for helping customers faster"
      friendlyName  = "Slack help bot - Platform Operations"
      hubResourceId = azapi_resource.hub.id
    }
    kind = "Project"
  })
}
