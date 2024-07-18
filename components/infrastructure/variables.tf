variable "environment" {}

variable "short_environment" {
  default = "ptl"
}

variable "product" {
  default = "slack-help-bot"
}

variable "location" {
  default = "uksouth"
}

variable "model_id" {
  default = "azureml://registries/azure-openai/models/gpt-4"
}