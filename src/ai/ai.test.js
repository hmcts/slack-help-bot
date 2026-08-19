const {
  formatKnowledgeStoreCaptions,
  formatKnowledgeStoreContext,
  sanitizeResolutionSummary,
  sanitizeSourceIndexes,
  sanitizeTicketType,
} = require("./ai");

describe("sanitizeTicketType", () => {
  it("defaults unknown values to support", () => {
    expect(sanitizeTicketType("task")).toBe("task");
    expect(sanitizeTicketType("unknown")).toBe("support");
    expect(sanitizeTicketType(undefined)).toBe("support");
  });
});

describe("formatKnowledgeStoreCaptions", () => {
  it("includes semantic highlights", () => {
    expect(
      formatKnowledgeStoreCaptions({
        captions: [
          {
            highlights:
              "Smoke / Functional test failure. Access the URL on VPN.",
          },
        ],
      }),
    ).toBe("Smoke / Functional test failure. Access the URL on VPN.");
  });

  it("falls back to semantic caption text", () => {
    expect(
      formatKnowledgeStoreCaptions({
        captions: [
          {
            text: "Jenkins only sets secrets as environment variables.",
          },
        ],
      }),
    ).toBe("Jenkins only sets secrets as environment variables.");
  });
});

describe("formatKnowledgeStoreContext", () => {
  it("puts relevant search captions into the model context", () => {
    const context = formatKnowledgeStoreContext(
      [
        {
          captions: [
            {
              highlights:
                "Smoke / Functional test failure. Access the URL on VPN.",
            },
          ],
          document: {
            title: "Troubleshooting issues",
            metadata_storage_path: "https://example.com/troubleshooting.html",
            content: "Full document content",
          },
        },
      ],
      "other",
    );

    expect(context).toContain("Platform: Cloud Native / SDS");
    expect(context).toContain("Relevant search captions:");
    expect(context).toContain("Smoke / Functional test failure");
  });

  it("falls back to all platforms when the area is unknown", () => {
    const context = formatKnowledgeStoreContext([
      {
        captions: [
          {
            highlights:
              "Smoke / Functional test failure. Access the URL on VPN.",
          },
        ],
        document: {
          title: "Troubleshooting issues",
          metadata_storage_path: "https://example.com/troubleshooting.html",
          content: "Full document content",
        },
      },
    ]);

    expect(context).toContain("Platform: All platforms");
  });
});

describe("sanitizeSourceIndexes", () => {
  it("keeps only valid one-based source indexes", () => {
    expect(sanitizeSourceIndexes([0, 1, 3, 4, "2"], 3)).toStrictEqual([1, 3]);
  });
});

describe("sanitizeResolutionSummary", () => {
  it("falls back when the summary is empty", () => {
    expect(sanitizeResolutionSummary("   ")).toBe(
      "Resolution not clear from the thread.",
    );
  });

  it("truncates long summaries for Slack modal input", () => {
    expect(sanitizeResolutionSummary("a".repeat(3000))).toHaveLength(2903);
  });
});
