/*module "openai" {
  source              = "git::https://github.com/Azure/terraform-azurerm-openai.git?ref=main"

  resource_group_name = azurerm_resource_group.this.name
  location            = var.location

  public_network_access_enabled = true
  account_name = "slack-help-bot-${var.short_environment}-openai"

  deployment = {
    "gpt-4-turbo-preview" = {
      name          = "gpt-4-turbo-preview"
      model_format  = "OpenAI"
      model_name    = "gpt-4"
      model_version = "0125-Preview"
      scale_type    = "Standard"
    },
  }

  depends_on = [
    azurerm_resource_group.this
  ]

  tags = local.common_tags
}*/