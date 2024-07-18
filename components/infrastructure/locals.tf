locals {
  criticality = {
    cftsbox-intsvc = "Low"
    cftptl-intsvc  = "Medium"
  }
  env_display_names = {
    cftsbox-intsvc = "sandbox"
    cftptl-intsvc  = "production"
  }
  common_tags = {
    "application"  = "core"
    "builtFrom"    = "hmcts/slack-help-bot"
    "businessArea" = "CFT"
    "environment"  = local.env_display_names[var.environment]
  }
}