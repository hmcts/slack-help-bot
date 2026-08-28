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
  "Other",
  "Bot Test",
];

const KNOWN_SUBCATEGORIES = {
  "Self-Service Gap": [
    "Database Updates",
    "Production Secrets Management",
    "Network Range",
    "Access Reset",
    "Elasticsearch",
    "User Permissions",
    "Other",
  ],
  "Platform One-Off Failure": [
    "Jenkins",
    "ASO",
    "Library",
    "Azure",
    "VPN",
    "Terraform Imports",
    "Terraform Locks",
    "Certificates",
    "Other",
  ],
  "Local Setup": ["VPN", "SSH", "Other"],
  "Service Misconfiguration": [
    "Secrets",
    "Helm Charts",
    "Flux Config",
    "Terraform / Azure Infrastructure",
    "Platform Config",
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
    "Other",
  ],
  "Platform Improvement": [
    "Pipeline Performance / Capacity",
    "Pipeline Scheduling / Monitoring",
    "Dependency / Library Compatibility",
    "Observability",
    "Other",
  ],
  "External Failure (GitHub / Azure / Sonarcloud etc)": [
    "GitHub",
    "Azure",
    "SonarCloud Integration Failure",
    "Other",
  ],
  Other: ["Test / Placeholder Ticket", "Insufficient Evidence", "Other"],
  "Bot Test": ["Other"],
};

const TAXONOMY_RULES = `
- Classify from the established root cause and resolution, not keywords, team names, or isolated error messages.
- Use Missing / Inadequate Docs when the user asked a question and the information they needed was not documented, or the available documentation was incomplete or inadequate. Do not use it merely because the user asked a question. If adequate documentation existed but was difficult to find, use Poor Signposting / Discoverability instead.
- Use User Education / Misuse when adequate documented guidance existed but the user did not follow it, misunderstood it, or used the platform incorrectly. If the guidance was missing, incomplete, or inadequate, use Missing / Inadequate Docs instead.
- User Education / Misuse / Terraform: the user did not follow or understand documented Terraform guidance.
- User Education / Misuse / GitHub / SSO: the user did not follow or understand documented GitHub SSO or organisation guidance.
- User Education / Misuse / Jenkins / Docker: the user did not follow documented Jenkins or Docker usage guidance, including workspace or permissions guidance.
- Tickets withdrawn because the requester used an incorrect process, chose the wrong request route, or did not follow the required process are User Education / Misuse. Do not apply this to withdrawals caused by inactivity, duplicates, or other administrative reasons unless the thread explicitly shows process misuse.
- Use Self-Service Gap when a supported service or action requires Platform Operations to do something because no self-service process or capability exists for the user or service team to do it themselves.
- Use Platform Improvement when an existing platform capability or behaviour should be enhanced, changed, or better aligned with user needs. Use Self-Service Gap when the required supported action has no self-service process at all.
- Platform Improvement / Pipeline Performance / Capacity: recurring performance, executor, node-capacity, or throughput improvements are needed.
- Platform Improvement / Pipeline Scheduling / Monitoring: pipeline scheduling, triggering, or monitoring behaviour needs improvement.
- Platform Improvement / Dependency / Library Compatibility: a dependency or library change requires platform compatibility improvements.
- Platform Improvement / Observability: platform telemetry, logging, tracing, or monitoring coverage needs improvement.
- Self-Service Gap includes what was previously called Platform Feature Missing: a required platform capability or self-service feature did not exist, so Platform Operations had to perform the action or provide a workaround.
- Self-Service Gap / Database Updates: Platform Operations had to perform a database update because no self-service process existed for the user or service team. Do not select it merely because a database was mentioned or when an existing database tool was restricted or defective.
- Self-Service Gap / Production Secrets Management: Platform Operations had to perform a production-secret operation because no self-service process existed. Incorrect or missing service-owned secret configuration belongs to Service Misconfiguration / Secrets instead.
- Self-Service Gap / Network Range: Platform Operations had to allocate, reserve, or change a network range because no self-service process existed. Network incidents and incorrect service-owned network configuration belong to their respective root-cause categories instead.
- Self-Service Gap / Access Reset: Platform Operations had to reset existing access because no self-service reset process existed. Requests to grant or change platform access belong to Platform Access instead.
- Self-Service Gap / Elasticsearch: Platform Operations had to perform a supported Elasticsearch operation because no self-service process existed. Elasticsearch incidents, service misconfiguration, and existing tooling limitations belong to their respective root-cause categories instead.
- Self-Service Gap / User Permissions: Platform Operations had to change user permissions because no self-service process existed. Granting, changing, or revoking access to Platform Operations-managed tooling belongs to Platform Access instead.
- Platform One-Off Failure / Jenkins: Jenkins normally supported the operation but failed unexpectedly on this occasion. Jenkins access requests belong to Platform Access / Jenkins.
- Platform One-Off Failure / Terraform Imports: a platform Terraform workflow failed or could not complete an otherwise supported import operation. Do not select it merely because Terraform or an import command was mentioned.
- Platform One-Off Failure / Terraform Locks: a Terraform state lock blocked an otherwise supported operation and was confirmed as the cause of the incident. Do not use it for service-owned Terraform configuration issues.
- Platform One-Off Failure / Certificates: platform certificate tooling or automation failed during an otherwise supported certificate operation. Certificate access requests and service-owned certificate configuration belong to their respective categories.
- Platform One-Off Failure / ASO: ASO is a Platform Operations tool; when ASO fails to provision access or another normally supported resource, classify the incident as Platform One-Off Failure / ASO. Requests for access or repeatable ASO capability limitations belong to their respective categories instead.
- Platform One-Off Failure / Library: breaking changes in a Platform Operations-managed library that cause an issue belong to Platform One-Off Failure / Library. Do not use this for application-owned library changes or a confirmed repeatable platform tooling limitation.
- Platform One-Off Failure / Azure: use this only when the Azure-hosted Platform Operations layer is the confirmed cause after ruling out Jenkins, Terraform Imports, Certificates, ASO, application configuration, and other platform tooling causes. An Azure error message alone is not sufficient.
- Platform One-Off Failure / VPN: use this for a confirmed shared or Platform Operations-managed VPN incident. Local VPN client, credential, or machine-specific problems belong to Local Setup / VPN; VPN access requests belong to Platform Access / VPN.
- Treat a normally supported pipeline or scheduled/recurring pipeline that fails on a particular run, or an existing platform tool that fails during an otherwise supported operation, as Platform One-Off Failure.
- Use Platform Access for granting, changing, or restoring access to Platform Operations-managed tooling or infrastructure. Joiner, mover, or leaver access requests are Platform Access.
- Platform Access / SSH: granting, changing, restoring, or revoking SSH access to Platform Operations-managed infrastructure. Problems with the user's local SSH client, keys, agent, or configuration belong to Local Setup / SSH instead.
- Platform Access / Azure: requesting, granting, changing, or troubleshooting a user's Azure role or permissions is Platform Access / Azure. Use External Failure / Azure only when the Azure service itself is established as the root cause of an incident.
- Entra ID and Azure Identity access or role requests are Platform Access / Azure; do not create a separate Entra ID sub-category.
- User offboarding, including removing or revoking a departing user's platform access, is Platform Access. Use the affected platform system as the sub-category where the evidence identifies it.
- Platform Access / New Setup: the user requested a genuinely new kind of platform access that required additional platform configuration, integration, or enablement. Do not use it for routine provisioning through an existing access path.
- Access Management is also the name of a team and service that runs on the platform. A bug, outage, deployment, configuration, or other operational issue with that service is not Platform Access merely because its name contains "Access".
- If someone from the Access Management team genuinely needs access to platform tooling or infrastructure, Platform Access can still be the correct category.
- Use Triage Error / Wrong Queue when the affected application or underlying issue belongs to a service or team not owned by Platform Operations, for example IDAM, CCD, or Access Management. Base this on established ownership or root cause, not merely the team that reported the ticket.
- Use External Failure only when the conversation establishes that an external provider or integration was the root cause. An error message from an external service is not enough by itself. Analyze the diagnosis and resolution before selecting External Failure. An Azure, GitHub, or SonarCloud error alone is insufficient because application configuration, user error, permissions, or another internal issue may have caused it.
- If the root cause was not established, use Other rather than inferring an external failure.
- External Failure sub-categories identify the confirmed external source: GitHub, Azure, SonarCloud Integration Failure, or Other.
- For network incidents, use External Failure only when the evidence confirms that Azure or another external network provider owned the root cause. Use Platform One-Off Failure when the failure came from HMCTS platform networking, components, or configuration running on top of Azure. Do not decide from the presence of an Azure error alone.
- Use Local Setup when the established cause is specific to the user's workstation or local development environment, such as local configuration, installed software, environment variables, credentials, or machine-specific state. Do not use it for a shared platform service failure merely observed from a local machine.
- Local Setup / VPN: the established cause was the user's local VPN client, configuration, credentials, or machine-specific VPN state. A shared VPN service or platform networking failure does not belong here.
- Local Setup / SSH: the established cause was the user's local SSH client, keys, agent, configuration, or machine-specific state. Platform access provisioning and shared platform failures belong to their respective categories instead.
- Use Service Misconfiguration when evidence confirms that incorrect or missing configuration owned by the affected application or service team caused the issue. Do not infer it from team identity, an error message, or suspicion. Use Local Setup for workstation-specific configuration and a platform category for configuration owned by Platform Operations.
- Service Misconfiguration sub-categories describe the misconfigured service-owned layer: Secrets, Helm Charts, Flux Config, Terraform / Azure Infrastructure, Platform Config, or Other. Use Terraform / Azure Infrastructure for service-owned Terraform or Azure resource configuration that is incorrect. Platform Config includes service-owned settings for shared components such as Application Gateway or Front Door; faults in Platform Operations-owned baselines or components belong to the relevant platform category instead.
- If the issue is clearly a Platform Operations support issue but the evidence does not establish a more specific category, use Platform One-Off Failure / Other with low confidence as the fallback. Use Other / Other only for clearly unrelated, test, placeholder, or genuinely non-platform issues.
- Bot Test: an intentional automated bot test or test ticket with no genuine support request. The standard Jira footer saying the ticket was automatically generated from Slack appears on normal tickets and is not evidence of a bot test. Require explicit test intent or unmistakable test/placeholder content before using Bot Test / Other.
`.trim();
module.exports = { RESOLUTION_CATEGORIES, KNOWN_SUBCATEGORIES, TAXONOMY_RULES };
