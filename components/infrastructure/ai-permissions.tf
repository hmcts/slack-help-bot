resource "azurerm_role_assignment" "identity_access_to_ai_services" {
  principal_id = azurerm_user_assigned_identity.managed_identity.principal_id
  scope        = azapi_resource.AIServices.id

  role_definition_name = "Cognitive Services OpenAI User"
}

data "azuread_group" "platops" {
  display_name     = "DTS Platform Operations"
  security_enabled = true
}

resource "azurerm_role_assignment" "platops_access_to_ai_services" {
  principal_id = data.azuread_group.platops.object_id
  scope        = azapi_resource.AIServices.id

  role_definition_name = "Cognitive Services OpenAI User"
}
