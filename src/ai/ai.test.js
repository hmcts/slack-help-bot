const {
  formatKnowledgeStoreCaptions,
  formatKnowledgeStoreContext,
  sanitizeSourceIndexes,
} = require("./ai");

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

    expect(context).toContain("Relevant search captions:");
    expect(context).toContain("Smoke / Functional test failure");
  });
});

describe("sanitizeSourceIndexes", () => {
  it("keeps only valid one-based source indexes", () => {
    expect(sanitizeSourceIndexes([0, 1, 3, 4, "2"], 3)).toStrictEqual([1, 3]);
  });
});
