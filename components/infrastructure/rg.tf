resource "azurerm_resource_group" "this" {
  location = var.location
  name     = "slack-help-bot-${var.long_environment}-rg"

  tags = module.tags.common_tags
}
