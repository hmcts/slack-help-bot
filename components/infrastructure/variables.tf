variable "long_environment" {
  description = "HMCTS long environment name used for resource group and identity naming."
  type        = string
  default     = "cftptl-intsvc"
}

variable "env" {
  description = "Short environment name used in the Azure AI Search service name."
  type        = string
  default     = "ptl"
}

variable "product" {
  description = "Product name used for Azure resource names and tags."
  type        = string
  default     = "ccpay-slack-help-bot"
}

variable "location" {
  description = "Azure region for the FeePay Search service."
  type        = string
  default     = "uksouth"
}

variable "builtFrom" {
  description = "Source repository tag for HMCTS common tags."
  type        = string
  default     = "hmcts/ccpay-slack-help-bot"
}

variable "github_repository" {
  description = "GitHub repository allowed to authenticate as the sync identity."
  type        = string
  default     = "hmcts/ccpay-slack-help-bot"
}

variable "github_branch" {
  description = "Branch allowed to use the sync identity through GitHub OIDC."
  type        = string
  default     = "main"
}
