module "application_insights" {
  source = "git::https://github.com/hmcts/terraform-module-application-insights.git?ref=main"

  product = var.product
  env     = var.env

  resource_group_name = azurerm_resource_group.this.name

  common_tags = module.tags.common_tags
}

resource "azurerm_key_vault_secret" "app_insights_connection_string" {
  name         = "app-insights-connection-string"
  key_vault_id = data.azurerm_key_vault.mgmt_kv.id
  value        = module.application_insights.connection_string
}
