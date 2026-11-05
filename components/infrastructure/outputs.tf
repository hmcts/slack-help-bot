output "azure_search_endpoint" {
  description = "Set as the AZURE_SEARCH_ENDPOINT GitHub Actions variable."
  value       = "https://${azurerm_search_service.feepay.name}.search.windows.net"
}

output "azure_app_runtime_client_id" {
  description = "Client ID of the FeePay Slack bot runtime managed identity; configure this identity in the app deployment."
  value       = azurerm_user_assigned_identity.app_runtime.client_id
}

output "azure_search_sync_client_id" {
  description = "Set as the AZURE_SEARCH_SYNC_CLIENT_ID GitHub Actions variable."
  value       = azurerm_user_assigned_identity.github_sync.client_id
}

output "azure_tenant_id" {
  description = "Set as the AZURE_TENANT_ID GitHub Actions variable."
  value       = data.azurerm_client_config.current.tenant_id
}
