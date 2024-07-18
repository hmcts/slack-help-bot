module "application_insights" {
  source = "git::https://github.com/hmcts/terraform-module-application-insights.git?ref=main"

  product = var.product
  env     = var.short_environment

  resource_group_name = azurerm_resource_group.this.name

  common_tags = local.common_tags
}
