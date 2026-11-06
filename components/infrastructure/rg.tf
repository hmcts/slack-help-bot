resource "azurerm_resource_group" "this" {
  location = var.location
  name     = "${var.product}-${var.long_environment}-rg"

  tags = module.tags.common_tags
}
