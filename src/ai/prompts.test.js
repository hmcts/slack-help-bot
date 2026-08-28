const {
  resolutionClassificationPrompt,
  resolutionDocumentationPrompt,
} = require("./prompts");

describe.each([
  ["resolution classification", resolutionClassificationPrompt],
  ["resolution documentation", resolutionDocumentationPrompt],
])("%s prompt", (_name, getPrompt) => {
  it("distinguishes platform access from the Access Management service", () => {
    const prompt = getPrompt();

    expect(prompt).toContain("- Platform Access");
    expect(prompt).toContain(
      'Access Management is also the name of a team and service that runs on the platform. A bug, outage, deployment, configuration, or other operational issue with that service is not Platform Access merely because its name contains "Access".',
    );
    expect(prompt).toContain(
      "If someone from the Access Management team genuinely needs access to platform tooling or infrastructure, Platform Access can still be the correct category.",
    );
    expect(prompt).not.toContain("- Joiner / Mover / Leaver (JML)");
    expect(prompt).toContain(
      "Joiner, mover, or leaver access requests are Platform Access",
    );
    expect(prompt).toContain(
      "User offboarding, including removing or revoking a departing user's platform access, is Platform Access",
    );
  });

  it("categorizes issues owned outside Platform Operations as wrong queue", () => {
    const prompt = getPrompt();

    expect(prompt).not.toContain("- Other Service / Team Issue");
    expect(prompt).toContain(
      "Use Triage Error / Wrong Queue when the affected application or underlying issue belongs to a service or team not owned by Platform Operations",
    );
    expect(prompt).toContain("for example IDAM, CCD, or Access Management");
    expect(prompt).toContain("not merely the team that reported the ticket");
  });

  it("requires an established root cause before selecting External Failure", () => {
    const prompt = getPrompt();

    expect(prompt).toContain(
      "An error message from an external service is not enough by itself",
    );
    expect(prompt).toContain(
      "Analyze the diagnosis and resolution before selecting External Failure",
    );
    expect(prompt).toContain(
      "use Other rather than inferring an external failure",
    );
    expect(prompt).not.toContain("- Network Failure");
    expect(prompt).toContain(
      "use External Failure only when the evidence confirms that Azure or another external network provider owned the root cause",
    );
    expect(prompt).toContain(
      "Use Platform One-Off Failure when the failure came from HMCTS platform networking, components, or configuration running on top of Azure",
    );
  });

  it("treats recurring pipeline run failures as one-off failures", () => {
    const prompt = getPrompt();

    expect(prompt).toContain(
      "normally supported pipeline or scheduled/recurring pipeline that fails on a particular run, or an existing platform tool that fails during an otherwise supported operation, as Platform One-Off Failure",
    );
  });

  it("uses Other when the category cannot be established", () => {
    const prompt = getPrompt();

    expect(prompt).toContain("- Other");
    expect(prompt).not.toContain('reply with "Unknown"');
    expect(prompt).toContain(
      "clearly a Platform Operations support issue but the evidence does not establish a more specific category",
    );
  });

  it("does not treat the standard Slack-generated Jira footer as a bot test", () => {
    expect(resolutionDocumentationPrompt()).toContain(
      "standard Jira footer saying the ticket was automatically generated from Slack",
    );
    expect(resolutionClassificationPrompt()).toContain(
      "standard Jira footer saying the ticket was automatically generated from Slack",
    );
  });

  it("classifies process-related withdrawals as user education or misuse", () => {
    expect(resolutionDocumentationPrompt()).toContain(
      "Tickets withdrawn because the requester used an incorrect process",
    );
    expect(resolutionClassificationPrompt()).toContain(
      "Tickets withdrawn because the requester used an incorrect process",
    );
  });

  it("uses Missing / Inadequate Docs only when documentation is absent or inadequate", () => {
    const prompt = getPrompt();

    expect(prompt).toContain(
      "the information they needed was not documented, or the available documentation was incomplete or inadequate",
    );
    expect(prompt).toContain(
      "Do not use it merely because the user asked a question",
    );
    expect(prompt).toContain(
      "If adequate documentation existed but was difficult to find, use Poor Signposting / Discoverability instead",
    );
  });

  it("uses User Education / Misuse when documented guidance was not followed", () => {
    const prompt = getPrompt();

    expect(prompt).toContain("- User Education / Misuse");
    expect(prompt).toContain(
      "adequate documented guidance existed but the user did not follow it",
    );
  });

  it("distinguishes a missing self-service process from a platform failure", () => {
    const prompt = getPrompt();

    expect(prompt).toContain(
      "Use Self-Service Gap when a supported service or action requires Platform Operations to do something because no self-service process or capability exists",
    );
    expect(prompt).toContain(
      "existing platform tool that fails during an otherwise supported operation, as Platform One-Off Failure",
    );
  });

  it("uses Platform Improvement for capability enhancements", () => {
    const prompt = getPrompt();

    expect(prompt).toContain(
      "Use Platform Improvement when an existing platform capability or behaviour should be enhanced",
    );
  });

  it("uses Local Setup only for machine-specific causes", () => {
    const prompt = getPrompt();

    expect(prompt).toContain("- Local Setup");
    expect(prompt).toContain(
      "the established cause is specific to the user's workstation or local development environment",
    );
    expect(prompt).toContain(
      "Do not use it for a shared platform service failure merely observed from a local machine",
    );
  });

  it("uses Service Misconfiguration only for confirmed service-owned configuration", () => {
    const prompt = getPrompt();

    expect(prompt).toContain("- Service Misconfiguration");
    expect(prompt).toContain(
      "incorrect or missing configuration owned by the affected application or service team caused the issue",
    );
    expect(prompt).toContain(
      "Use Local Setup for workstation-specific configuration and a platform category for configuration owned by Platform Operations",
    );
  });
});
