locals {
  criticality = {
    cftsbox-intsvc     = "Low"
    cftptl-intsvc      = "Medium"
  }
  env_display_names = {
    cftsbox-intsvc     = "Mgmt Sandbox"
    cftptl-intsvc      = "Mgmt"
  }
  common_tags = {
    "managedBy"          = "PlatOps"
    "solutionOwner"      = "CFT"
    "activityName"       = var.activity_name
    "dataClassification" = "Internal"
    "automation"         = ""
    "costCentre"         = "10245117" // until we get a better one, this is the generic cft contingency one
    "environment"        = local.env_display_names[var.environment]
    "criticality"        = local.criticality[var.environment]
  }
}