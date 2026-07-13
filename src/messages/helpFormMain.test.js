const { helpFormRelatedIssuesBlocks } = require("./helpFormMain");

describe("helpFormRelatedIssuesBlocks", () => {
  it("shows the resolution for related issues when present", () => {
    const blocks = helpFormRelatedIssuesBlocks({
      relatedIssues: [
        {
          title: "Jenkins build failing at functional test",
          status: "Done",
          created_at: new Date("2025-01-01T12:00:00.000Z"),
          url: "https://example.com/JRA-1",
          key: "JRA-1",
          resolution:
            "A missing secret was added and the pods were restarted through Flux.",
        },
      ],
      isAdvanced: true,
      area: "other",
    });

    expect(
      blocks.find(
        (block) =>
          block.type === "context" &&
          block.elements?.[0]?.text?.includes("Resolution:"),
      ),
    ).toBeDefined();
  });
});
