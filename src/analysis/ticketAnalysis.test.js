const {
  RESOLUTION_CATEGORIES,
  KNOWN_SUBCATEGORIES,
  buildIssueAuditTable,
  buildReportPrompt,
  distributionFor,
  extractSlackPermalink,
  formatSlackThread,
  getAnalysisPeriod,
  getExistingClassification,
  normalizeAnalysisClassification,
  parseSlackPermalink,
} = require("./ticketAnalysis");

describe("Slack evidence helpers", () => {
  const permalink =
    "https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1754042400123456";

  it("extracts and parses a Slack permalink", () => {
    expect(extractSlackPermalink(`h6. [view in Slack|${permalink}]`)).toBe(
      permalink,
    );
    expect(parseSlackPermalink(permalink)).toStrictEqual({
      channel: "C01KHKNJUKE",
      ts: "1754042400.123456",
    });
  });

  it("extracts readable text from Slack blocks", () => {
    expect(
      formatSlackThread([
        {
          ts: "1.2",
          text: "Fallback text",
          blocks: [{ text: { type: "mrkdwn", text: "Root cause found" } }],
        },
      ]),
    ).toContain("Root cause found");
  });
});

describe("ticket analysis helpers", () => {
  const analyses = [
    {
      key: "DTSPO-1",
      rootCause: "Access was missing",
      existingClassification: null,
      recommendedCategory: "Platform Access",
      recommendedSubCategory: "GitHub",
      confidence: "high",
      evidenceLimitation: null,
    },
    {
      key: "DTSPO-2",
      recommendedCategory: "Platform Access",
      recommendedSubCategory: "Other",
    },
  ];

  it("builds a period from days or an exclusive end date", () => {
    expect(
      getAnalysisPeriod({ startDate: "2026-07-01", days: 10 }),
    ).toStrictEqual({ from: "2026-07-01", toExclusive: "2026-07-11" });
    expect(
      getAnalysisPeriod({ startDate: "2026-07-01", endDate: "2026-07-15" }),
    ).toStrictEqual({ from: "2026-07-01", toExclusive: "2026-07-15" });
    expect(() =>
      getAnalysisPeriod({
        startDate: "2026-07-01",
        days: 7,
        endDate: "2026-07-08",
      }),
    ).toThrow("either end date or days");
    expect(() =>
      getAnalysisPeriod({ startDate: "2026-07-01", days: 0 }),
    ).toThrow("positive whole number");
  });

  it("reads an existing resolution label", () => {
    expect(
      getExistingClassification(["team-xui", "resolution-platform-access"]),
    ).toBe("platform access");
  });

  it("maps historical resolution labels to renamed categories", () => {
    expect(
      getExistingClassification(["resolution-tooling-/-automation-deficiency"]),
    ).toBe("Platform One-Off Failure");
    expect(
      getExistingClassification([
        "resolution-platform-feature-missing-/-misaligned",
      ]),
    ).toBe("Platform Improvement");
  });

  it("includes Local Setup in the analysis taxonomy", () => {
    expect(RESOLUTION_CATEGORIES).toContain("Local Setup");
    expect(RESOLUTION_CATEGORIES).toContain("Service Misconfiguration");
    expect(RESOLUTION_CATEGORIES).not.toContain("Network Failure");
    expect(RESOLUTION_CATEGORIES).toContain("Other");
    expect(RESOLUTION_CATEGORIES).toContain("Platform Improvement");
    expect(RESOLUTION_CATEGORIES).toContain("Bot Test");
    expect(KNOWN_SUBCATEGORIES.Other).toStrictEqual([
      "Test / Placeholder Ticket",
      "Insufficient Evidence",
      "Other",
    ]);
  });

  it("uses a low-confidence platform fallback for unknown classifications", () => {
    expect(
      normalizeAnalysisClassification({
        recommendedCategory: "Unknown",
        recommendedSubCategory: "Unknown",
      }),
    ).toMatchObject({
      recommendedCategory: "Platform One-Off Failure",
      recommendedSubCategory: "Other",
      confidence: "low",
    });
    expect(normalizeAnalysisClassification({})).toMatchObject({
      recommendedCategory: "Platform One-Off Failure",
      recommendedSubCategory: "Other",
      confidence: "low",
    });
  });

  it("uses Other when only the sub-category is unknown", () => {
    expect(
      normalizeAnalysisClassification({
        recommendedCategory: "Platform Access",
        recommendedSubCategory: "Unknown",
      }),
    ).toMatchObject({
      recommendedCategory: "Platform Access",
      recommendedSubCategory: "Other",
    });
  });

  it("normalizes the renamed infrastructure sub-category", () => {
    expect(
      normalizeAnalysisClassification({
        recommendedCategory: "Service Misconfiguration",
        recommendedSubCategory: "Terraform / Infrastructure",
      }).recommendedSubCategory,
    ).toBe("Terraform / Azure Infrastructure");
  });

  it("includes New Setup under Platform Access", () => {
    expect(KNOWN_SUBCATEGORIES["Platform Access"]).toContain("New Setup");
    expect(KNOWN_SUBCATEGORIES["Platform Access"]).toContain("LaunchDarkly");
    expect(KNOWN_SUBCATEGORIES["Platform Access"]).toContain("SSH");
  });

  it("classifies user offboarding as Platform Access", () => {
    const prompt = buildReportPrompt({
      project: "DTSPO",
      period: { from: "2026-07-01", toExclusive: "2026-07-08" },
      analyses: [],
    });

    expect(prompt).toContain(
      "User offboarding, including removing or revoking a departing user's platform access, is Platform Access",
    );
  });

  it("includes Database Updates under Self-Service Gap", () => {
    expect(KNOWN_SUBCATEGORIES["Self-Service Gap"]).toContain(
      "Database Updates",
    );
    expect(KNOWN_SUBCATEGORIES["Self-Service Gap"]).toContain(
      "Production Secrets Management",
    );
    expect(KNOWN_SUBCATEGORIES["Self-Service Gap"]).toContain("Network Range");
    expect(KNOWN_SUBCATEGORIES["Self-Service Gap"]).toContain("Access Reset");
    expect(KNOWN_SUBCATEGORIES["Self-Service Gap"]).toContain("Elasticsearch");
    expect(KNOWN_SUBCATEGORIES["Self-Service Gap"]).toContain(
      "User Permissions",
    );
  });

  it("includes Terraform Imports under Platform One-Off Failure", () => {
    expect(KNOWN_SUBCATEGORIES["Platform One-Off Failure"]).toContain(
      "Terraform Imports",
    );
  });

  it("includes Terraform Locks under Platform One-Off Failure", () => {
    expect(KNOWN_SUBCATEGORIES["Platform One-Off Failure"]).toContain(
      "Terraform Locks",
    );
  });

  it("includes Certificates under Platform One-Off Failure", () => {
    expect(KNOWN_SUBCATEGORIES["Platform One-Off Failure"]).toContain(
      "Certificates",
    );
  });

  it("includes Jenkins under Platform One-Off Failure", () => {
    expect(KNOWN_SUBCATEGORIES["Platform One-Off Failure"]).toContain(
      "Jenkins",
    );
  });

  it("includes ASO under Platform One-Off Failure", () => {
    expect(KNOWN_SUBCATEGORIES["Platform One-Off Failure"]).toContain("ASO");
  });

  it("includes Azure role access under Platform Access", () => {
    const prompt = buildReportPrompt({
      project: "DTSPO",
      period: { from: "2026-07-01", toExclusive: "2026-07-08" },
      analyses: [],
    });

    expect(prompt).toContain(
      "requesting, granting, changing, or troubleshooting a user's Azure role or permissions is Platform Access / Azure",
    );
  });

  it("includes Library under Platform One-Off Failure", () => {
    expect(KNOWN_SUBCATEGORIES["Platform One-Off Failure"]).toContain(
      "Library",
    );
  });

  it("includes Azure under Platform One-Off Failure", () => {
    expect(KNOWN_SUBCATEGORIES["Platform One-Off Failure"]).toContain("Azure");
  });

  it("includes VPN under Platform One-Off Failure", () => {
    expect(KNOWN_SUBCATEGORIES["Platform One-Off Failure"]).toContain("VPN");
  });

  it("explains recurring pipeline failures as one-off failures", () => {
    const prompt = buildReportPrompt({
      project: "DTSPO",
      period: { from: "2026-07-01", toExclusive: "2026-07-08" },
      analyses: [],
    });

    expect(prompt).toContain(
      "normally supported pipeline or scheduled/recurring pipeline that fails on a particular run",
    );
  });

  it("distinguishes missed documented guidance from missing documentation", () => {
    const prompt = buildReportPrompt({
      project: "DTSPO",
      period: { from: "2026-07-01", toExclusive: "2026-07-08" },
      analyses: [],
    });

    expect(prompt).toContain(
      "adequate documented guidance existed but the user did not follow it",
    );
    expect(prompt).toContain(
      "If the guidance was missing, incomplete, or inadequate, use Missing / Inadequate Docs instead",
    );
  });

  it("renames missing platform features as Platform Improvement", () => {
    const prompt = buildReportPrompt({
      project: "DTSPO",
      period: { from: "2026-07-01", toExclusive: "2026-07-08" },
      analyses: [],
    });

    expect(prompt).toContain(
      "Use Platform Improvement when an existing platform capability",
    );
  });

  it("includes Bot Test with an Other sub-category", () => {
    expect(KNOWN_SUBCATEGORIES["Bot Test"]).toStrictEqual(["Other"]);
  });

  it("includes VPN and SSH under Local Setup", () => {
    expect(KNOWN_SUBCATEGORIES["Local Setup"]).toStrictEqual([
      "VPN",
      "SSH",
      "Other",
    ]);
  });

  it("includes the Service Misconfiguration sub-categories", () => {
    expect(KNOWN_SUBCATEGORIES["Service Misconfiguration"]).toStrictEqual([
      "Secrets",
      "Helm Charts",
      "Flux Config",
      "Terraform / Azure Infrastructure",
      "Platform Config",
      "Other",
    ]);
  });

  it("includes GitHub and Azure under External Failure", () => {
    const subCategories =
      KNOWN_SUBCATEGORIES["External Failure (GitHub / Azure / Sonarcloud etc)"];

    expect(subCategories).toContain("GitHub");
    expect(subCategories).toContain("Azure");
  });

  it("calculates deterministic category and sub-category counts", () => {
    expect(distributionFor(analyses)).toStrictEqual({
      "Platform Access": {
        total: 2,
        subCategories: { GitHub: 1, Other: 1 },
      },
    });
  });

  it("includes the distribution and issue evidence in the report prompt", () => {
    const prompt = buildReportPrompt({
      project: "DTSPO",
      period: { from: "2026-07-01", toExclusive: "2026-08-01" },
      analyses,
    });
    expect(prompt).toContain('"GitHub": 1');
    expect(prompt).toContain("DTSPO-1");
  });

  it("builds a Markdown issue audit", () => {
    expect(buildIssueAuditTable(analyses)).toContain(
      "| DTSPO-1 | Access was missing |",
    );
  });
});
