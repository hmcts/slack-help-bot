resource "azurerm_storage_account" "default" {
  name                            = "platopslackhelpbotai"
  location                        = azurerm_resource_group.this.location
  resource_group_name             = azurerm_resource_group.this.name
  account_tier                    = "Standard"
  account_replication_type        = "ZRS"
  allow_nested_items_to_be_public = false

  tags = local.common_tags
}
