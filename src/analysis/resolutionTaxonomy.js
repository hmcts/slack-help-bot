const RESOLUTION_CATEGORIES = [
  "Missing / Inadequate Docs",
  "Self-Service Gap",
  "Platform Improvement",
  "Poor Signposting / Discoverability",
  "User Education / Misuse",
  "Policy / Process Ambiguity",
  "Platform One-Off Failure",
  "External Failure (GitHub / Azure / Sonarcloud etc)",
  "Triage Error / Wrong Queue",
  "Platform Access",
  "Local Setup",
  "Service Misconfiguration",
  "Release Support",
  "Withdrawn / Duplicate",
  "Other",
  "Bot Test",
];

const KNOWN_SUBCATEGORIES = {
  "Missing / Inadequate Docs": [
    "Access / Identity",
    "CI/CD / Automation",
    "Database",
    "Developer Setup",
    "Other",
  ],
  "Self-Service Gap": [
    "Database Updates",
    "Production Secrets Management",
    "Network Range",
    "Access Reset",
    "Elasticsearch",
    "User Permissions",
    "Terraform / Azure Infrastructure",
    "GitHub Administration",
    "CI/CD / Automation",
    "Environment Scheduling",
    "Observability / Dashboards",
    "Resource Decommissioning",
    "Other",
  ],
  "Platform One-Off Failure": [
    "Jenkins",
    "CI/CD / Automation",
    "ASO",
    "Library",
    "Azure",
    "Application Gateway",
    "AKS / Kubernetes",
    "Observability / Grafana",
    "VPN",
    "Terraform Imports",
    "Terraform Locks",
    "Certificates",
    "Other",
  ],
  "Local Setup": ["VPN", "SSH", "Developer Tooling", "Other"],
  "Service Misconfiguration": [
    "Secrets",
    "Helm Charts",
    "Flux Config",
    "Terraform / Azure Infrastructure",
    "Platform Config",
    "Database",
    "Identity / Authentication",
    "CI/CD / Automation",
    "Observability / Grafana",
    "Other",
  ],
  "Platform Access": [
    "Azure",
    "GitHub",
    "VPN",
    "Slack",
    "Jenkins",
    "SSH",
    "LaunchDarkly",
    "New Setup",
    "Gerrit",
    "Other",
  ],
  "User Education / Misuse": [
    "Terraform",
    "GitHub / SSO",
    "Jenkins / Docker",
    "Azure / IAM",
    "Database",
    "Identity / Authentication",
    "Secrets / Key Vault",
    "SonarCloud",
    "Other",
  ],
  "Platform Improvement": [
    "Pipeline Performance / Capacity",
    "Pipeline Scheduling / Monitoring",
    "Dependency / Library Compatibility",
    "Observability",
    "Certificate Automation",
    "CI/CD / Automation",
    "Other",
  ],
  "Poor Signposting / Discoverability": [
    "Access / Identity",
    "CI/CD / Automation",
    "Database",
    "Developer Setup",
    "Other",
  ],
  "Policy / Process Ambiguity": [
    "Access Governance",
    "Deployment / Environment Process",
    "Security / Compliance",
    "Other",
  ],
  "External Failure (GitHub / Azure / Sonarcloud etc)": [
    "GitHub",
    "Azure",
    "SonarCloud Integration Failure",
    "External Provider",
    "Other",
  ],
  "Triage Error / Wrong Queue": [
    "IDAM",
    "CCD",
    "Low Code / Power Platform",
    "Other Team",
    "Other",
  ],
  "Release Support": [
    "Application Deployment",
    "Infrastructure Change",
    "Certificates",
    "Other",
  ],
  "Withdrawn / Duplicate": [
    "Duplicate",
    "Withdrawn",
    "No Longer Required",
    "No Issue Found",
    "Other",
  ],
  Other: ["Test / Placeholder Ticket", "Insufficient Evidence", "Other"],
  "Bot Test": ["Other"],
};

const SUBCATEGORY_ALIASES = {
  "Terraform / Infrastructure": "Terraform / Azure Infrastructure",
  "Other.": "Other",
};

function cleanTaxonomyValue(value) {
  const cleaned = String(value ?? "").trim();
  return ["null", "none", "unknown", "n/a"].includes(cleaned.toLowerCase())
    ? ""
    : cleaned;
}

function normalizeCategory(value) {
  const requested = cleanTaxonomyValue(value).replace(/[.]+$/, "");
  return RESOLUTION_CATEGORIES.find(
    (category) => category.toLowerCase() === requested.toLowerCase(),
  );
}

function normalizeSubCategory(category, value, fallback = "Other") {
  const allowed = KNOWN_SUBCATEGORIES[category] || ["Other"];
  const requested = cleanTaxonomyValue(value);
  const aliased =
    SUBCATEGORY_ALIASES[requested] || requested.replace(/[.]+$/, "");
  return (
    allowed.find(
      (subCategory) => subCategory.toLowerCase() === aliased.toLowerCase(),
    ) || fallback
  );
}

const TAXONOMY_RULES = `
- Classify from the strongest established evidence in this order: administrative disposition, the type of request or operation performed, the resolution, then the confirmed root cause. Do not classify from keywords, team names, or isolated error messages.
- A confirmed root cause is not required when the request or completed action establishes the category. Access provisioning or restoration, a manual database operation, a routine certificate renewal, a redirect to the owning support team, and a withdrawn or duplicate request can all be classified from the request and resolution.
- Use Missing / Inadequate Docs when the user asked a question and the information they needed was not documented, or the available documentation was incomplete or inadequate. Do not use it merely because the user asked a question. If adequate documentation existed but was difficult to find, use Poor Signposting / Discoverability instead.
- Use User Education / Misuse when adequate documented guidance existed but the user did not follow it, misunderstood it, or used the platform incorrectly. If the guidance was missing, incomplete, or inadequate, use Missing / Inadequate Docs instead.
- User Education / Misuse / Terraform: the user did not follow or understand documented Terraform guidance.
- User Education / Misuse / GitHub / SSO: the user did not follow or understand documented GitHub SSO or organisation guidance.
- User Education / Misuse / Jenkins / Docker: the user did not follow documented Jenkins or Docker usage guidance, including workspace or permissions guidance.
- User Education / Misuse sub-categories describe the affected capability. Use Azure / IAM for documented Azure role-assignment guidance, Database for documented database processes, Identity / Authentication for incorrect authentication usage, Secrets / Key Vault for documented secret handling, and SonarCloud for documented SonarCloud configuration.
- Tickets withdrawn because the requester used an incorrect process, chose the wrong request route, or did not follow the required process are User Education / Misuse. Do not apply this to withdrawals caused by inactivity, duplicates, or other administrative reasons unless the thread explicitly shows process misuse.
- Use Self-Service Gap when a supported service or action requires Platform Operations to do something because no self-service process or capability exists for the user or service team to do it themselves.
- Use Platform Improvement when an existing platform capability or behaviour should be enhanced, changed, or better aligned with user needs. Use Self-Service Gap when the required supported action has no self-service process at all.
- Platform Improvement / Pipeline Performance / Capacity: recurring performance, executor, node-capacity, or throughput improvements are needed.
- Platform Improvement / Pipeline Scheduling / Monitoring: pipeline scheduling, triggering, or monitoring behaviour needs improvement.
- Platform Improvement / Dependency / Library Compatibility: a dependency or library change requires platform compatibility improvements.
- Platform Improvement / Observability: platform telemetry, logging, tracing, or monitoring coverage needs improvement.
- Platform Improvement / Certificate Automation: certificate renewal, validation, or expiry automation needs a repeatable improvement rather than recovery from a single failed run.
- Platform Improvement / CI/CD / Automation: a repeatable workflow or automation behaviour needs enhancement and is not specifically a performance, capacity, scheduling, or monitoring problem.
- Self-Service Gap includes what was previously called Platform Feature Missing: a required platform capability or self-service feature did not exist, so Platform Operations had to perform the action or provide a workaround.
- Self-Service Gap / Database Updates: Platform Operations had to perform a database update because no self-service process existed for the user or service team. Do not select it merely because a database was mentioned or when an existing database tool was restricted or defective.
- A request for Platform Operations to run a database job, catch-up, script, clone operation, or data change is sufficient evidence for Self-Service Gap / Database Updates when it is a supported operation the requester could not perform themselves; a separate technical root cause is not required.
- Self-Service Gap / Production Secrets Management: Platform Operations had to perform a production-secret operation because no self-service process existed. Incorrect or missing service-owned secret configuration belongs to Service Misconfiguration / Secrets instead.
- Self-Service Gap / Network Range: Platform Operations had to allocate, reserve, or change a network range because no self-service process existed. Network incidents and incorrect service-owned network configuration belong to their respective root-cause categories instead.
- Self-Service Gap / Access Reset: Platform Operations had to reset existing access because no self-service reset process existed. Requests to grant or change platform access belong to Platform Access instead.
- Self-Service Gap / Elasticsearch: Platform Operations had to perform a supported Elasticsearch operation because no self-service process existed. Elasticsearch incidents, service misconfiguration, and existing tooling limitations belong to their respective root-cause categories instead.
- Self-Service Gap / User Permissions: Platform Operations had to change user permissions because no self-service process existed. Granting, changing, or revoking access to Platform Operations-managed tooling belongs to Platform Access instead.
- Self-Service Gap sub-categories describe the action users could not perform themselves. Use Terraform / Azure Infrastructure for supported infrastructure operations such as temporary state imports that require Platform Operations, GitHub Administration for GitHub app or repository administration, CI/CD / Automation for pipeline administration, Environment Scheduling for start/stop schedule changes, Observability / Dashboards for dashboard administration, and Resource Decommissioning for removing repositories, pipelines, or infrastructure.
- Platform One-Off Failure / Jenkins: Jenkins normally supported the operation but failed unexpectedly on this occasion. Jenkins access requests belong to Platform Access / Jenkins.
- Platform One-Off Failure / Terraform Imports: a platform Terraform workflow failed or could not complete an otherwise supported import operation. Do not select it merely because Terraform or an import command was mentioned.
- Platform One-Off Failure / Terraform Locks: a Terraform state lock blocked an otherwise supported operation and was confirmed as the cause of the incident. Do not use it for service-owned Terraform configuration issues.
- Platform One-Off Failure / Certificates: platform certificate tooling or automation failed during an otherwise supported certificate operation. Certificate access requests and service-owned certificate configuration belong to their respective categories.
- Platform One-Off Failure / ASO: ASO is a Platform Operations tool; when ASO fails to provision access or another normally supported resource, classify the incident as Platform One-Off Failure / ASO. Requests for access or repeatable ASO capability limitations belong to their respective categories instead.
- Platform One-Off Failure / Library: breaking changes in a Platform Operations-managed library that cause an issue belong to Platform One-Off Failure / Library. Do not use this for application-owned library changes or a confirmed repeatable platform tooling limitation.
- Platform One-Off Failure / Azure: use this only when the Azure-hosted Platform Operations layer is the confirmed cause after ruling out Jenkins, Terraform Imports, Certificates, ASO, application configuration, and other platform tooling causes. An Azure error message alone is not sufficient.
- Platform One-Off Failure / VPN: use this for a confirmed shared or Platform Operations-managed VPN incident. Local VPN client, credential, or machine-specific problems belong to Local Setup / VPN; VPN access requests belong to Platform Access / VPN.
- Platform One-Off Failure / Application Gateway: a Platform Operations-managed Application Gateway failed during an otherwise supported operation, including an expected start-up.
- Platform One-Off Failure / AKS / Kubernetes: a shared or Platform Operations-managed Kubernetes capability failed unexpectedly. Service-owned manifests and configuration belong to Service Misconfiguration.
- Platform One-Off Failure / CI/CD / Automation: a supported pipeline or automation run failed unexpectedly and no more specific Jenkins, VPN, certificate, Terraform, or other sub-category applies.
- Platform One-Off Failure / Observability / Grafana: Platform Operations-managed monitoring, reporting, dashboard, or Grafana functionality failed unexpectedly.
- Treat a normally supported pipeline or scheduled/recurring pipeline that fails on a particular run, or an existing platform tool that fails during an otherwise supported operation, as Platform One-Off Failure.
- Use Platform Access for granting, changing, or restoring access to Platform Operations-managed tooling or infrastructure. Joiner, mover, or leaver access requests are Platform Access.
- Classify an access request from the access operation and affected system even when the reason access was missing is unknown. For example, restoring SSH access is Platform Access / SSH and enabling GitHub or Copilot access is Platform Access / GitHub.
- Platform Access / SSH: granting, changing, restoring, or revoking SSH access to Platform Operations-managed infrastructure. Problems with the user's local SSH client, keys, agent, or configuration belong to Local Setup / SSH instead.
- Platform Access / Azure: requesting, granting, changing, or troubleshooting a user's Azure role or permissions is Platform Access / Azure. Use External Failure / Azure only when the Azure service itself is established as the root cause of an incident.
- Entra ID and Azure Identity access or role requests are Platform Access / Azure; do not create a separate Entra ID sub-category.
- User offboarding, including removing or revoking a departing user's platform access, is Platform Access. Use the affected platform system as the sub-category where the evidence identifies it.
- Platform Access / New Setup: the user requested a genuinely new kind of platform access that required additional platform configuration, integration, or enablement. Do not use it for routine provisioning through an existing access path.
- Access Management is also the name of a team and service that runs on the platform. A bug, outage, deployment, configuration, or other operational issue with that service is not Platform Access merely because its name contains "Access".
- If someone from the Access Management team genuinely needs access to platform tooling or infrastructure, Platform Access can still be the correct category.
- Use Triage Error / Wrong Queue when the affected application or underlying issue belongs to a service or team not owned by Platform Operations, for example IDAM, CCD, or Access Management. Base this on established ownership or root cause, not merely the team that reported the ticket.
- When the resolution redirects the requester to a clearly identified owning support team without Platform Operations performing the requested work, that resolution is sufficient evidence for Triage Error / Wrong Queue. Use the owning-team sub-category where available.
- Use External Failure only when the conversation establishes that an external provider or integration was the root cause. An error message from an external service is not enough by itself. Analyze the diagnosis and resolution before selecting External Failure. An Azure, GitHub, or SonarCloud error alone is insufficient because application configuration, user error, permissions, or another internal issue may have caused it.
- If the root cause was not established, use Other rather than inferring an external failure.
- External Failure sub-categories identify the confirmed external source: GitHub, Azure, SonarCloud Integration Failure, or Other.
- Use External Provider when a confirmed named third party caused the failure but is not GitHub, Azure, or SonarCloud.
- For network incidents, use External Failure only when the evidence confirms that Azure or another external network provider owned the root cause. Use Platform One-Off Failure when the failure came from HMCTS platform networking, components, or configuration running on top of Azure. Do not decide from the presence of an Azure error alone.
- Use Local Setup when the established cause is specific to the user's workstation or local development environment, such as local configuration, installed software, environment variables, credentials, or machine-specific state. Do not use it for a shared platform service failure merely observed from a local machine.
- Local Setup / VPN: the established cause was the user's local VPN client, configuration, credentials, or machine-specific VPN state. A shared VPN service or platform networking failure does not belong here.
- Local Setup / SSH: the established cause was the user's local SSH client, keys, agent, configuration, or machine-specific state. Platform access provisioning and shared platform failures belong to their respective categories instead.
- Use Service Misconfiguration when evidence confirms that incorrect or missing configuration owned by the affected application or service team caused the issue. Do not infer it from team identity, an error message, or suspicion. Use Local Setup for workstation-specific configuration and a platform category for configuration owned by Platform Operations.
- Service Misconfiguration sub-categories describe the misconfigured service-owned layer: Secrets, Helm Charts, Flux Config, Terraform / Azure Infrastructure, Platform Config, or Other. Use Terraform / Azure Infrastructure for service-owned Terraform or Azure resource configuration that is incorrect. Platform Config includes service-owned settings for shared components such as Application Gateway or Front Door; faults in Platform Operations-owned baselines or components belong to the relevant platform category instead.
- Use Release Support / Certificates for routine or proactive certificate review, issuance, installation, renewal, or provider-coordinated thumbprint changes. Use Platform One-Off Failure / Certificates only when evidence shows normally supported certificate tooling or automation failed on that occasion, and Platform Improvement / Certificate Automation when a repeatable automation improvement is required.
- When an unresolved technical symptom clearly affects a Platform Operations-owned component, use Platform One-Off Failure with the affected component sub-category and low confidence. This describes the support demand without claiming an unproven external or service-owned root cause.
- Use Other / Insufficient Evidence only when the administrative disposition, request type, affected capability, resolution, owner, and root cause all fail to establish a category. Do not use it merely because the root cause is not established.
- Use Withdrawn / Duplicate for administrative closures rather than Triage Error / Wrong Queue or Other. Use Duplicate when another ticket owns the same request, Withdrawn when the requester explicitly withdrew it, No Longer Required when the original need ceased, and No Issue Found when investigation confirmed there was no actionable fault. Where possible retain a link to the canonical ticket in the resolution note for duplicates.
- Bot Test: an intentional automated bot test or test ticket with no genuine support request. The standard Jira footer saying the ticket was automatically generated from Slack appears on normal tickets and is not evidence of a bot test. Require explicit test intent or unmistakable test/placeholder content before using Bot Test / Other.
`.trim();
module.exports = {
  RESOLUTION_CATEGORIES,
  KNOWN_SUBCATEGORIES,
  TAXONOMY_RULES,
  normalizeCategory,
  normalizeSubCategory,
};
