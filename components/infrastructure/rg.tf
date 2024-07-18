resource "azurerm_resource_group" "this" {
  location = var.location
  name     = "slack-help-bot-${var.environment}-rg"

  tags = local.common_tags
}
