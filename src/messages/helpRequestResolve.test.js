const {
  CATEGORY_BLOCK_ID,
  CATEGORY_PENDING_BLOCK_ID,
  createResolvePrivateMetadata,
  findResolutionCategoryOption,
  getResolutionCategories,
  HOW_BLOCK_ID,
  HOW_PENDING_BLOCK_ID,
  helpRequestResolveBlocks,
  parseResolvePrivateMetadata,
} = require("./helpRequestResolve");

describe("helpRequestResolveBlocks", () => {
  it("prefills the how field with the suggested resolution", () => {
    const view = helpRequestResolveBlocks({
      thread_ts: "123.456",
      area: "other",
      suggestedResolution: "The user was directed to the correct runbook.",
    });

    const howBlock = view.blocks.find(
      (block) => block.block_id === HOW_BLOCK_ID,
    );

    expect(howBlock.element.initial_value).toBe(
      "The user was directed to the correct runbook.",
    );
    expect(howBlock.label.text).toContain("AI suggested");
  });

  it("shows a loading hint while AI suggestions are being prepared", () => {
    const view = helpRequestResolveBlocks({
      thread_ts: "123.456",
      area: "other",
      isAiSuggestionLoading: true,
    });

    expect(
      view.blocks.find(
        (block) => block.block_id === "ai_suggestion_loading_block",
      ),
    ).toBeDefined();
    expect(
      view.blocks.find((block) => block.block_id === CATEGORY_PENDING_BLOCK_ID),
    ).toBeDefined();
    expect(
      view.blocks.find((block) => block.block_id === HOW_PENDING_BLOCK_ID),
    ).toBeDefined();
  });

  it("uses final field ids after AI suggestions are loaded", () => {
    const view = helpRequestResolveBlocks({
      thread_ts: "123.456",
      area: "other",
      suggestedCategory: {
        category: "Incident / One-Off Platform Failure",
        confidence: "high",
      },
      suggestedResolution: "The failing job was restarted.",
    });

    expect(
      view.blocks.find((block) => block.block_id === CATEGORY_BLOCK_ID),
    ).toBeDefined();
    expect(
      view.blocks.find((block) => block.block_id === HOW_BLOCK_ID),
    ).toBeDefined();
    expect(
      view.blocks.find((block) => block.block_id === CATEGORY_PENDING_BLOCK_ID),
    ).toBeUndefined();
  });

  it("stores the suggested category in private metadata", () => {
    const view = helpRequestResolveBlocks({
      thread_ts: "123.456",
      area: "other",
      suggestedCategory: {
        category: "Incident / One-Off Platform Failure",
        confidence: "high",
      },
      suggestedResolution: "The failing job was restarted.",
    });

    expect(parseResolvePrivateMetadata(view.private_metadata)).toStrictEqual({
      threadTs: "123.456",
      suggestedCategory: "incident / one-off platform failure",
      suggestedCategoryLabel: "Incident / One-Off Platform Failure",
      suggestedResolution: "The failing job was restarted.",
    });
  });
});

describe("createResolvePrivateMetadata", () => {
  it("keeps legacy metadata shape when there is no suggested category", () => {
    expect(createResolvePrivateMetadata({ threadTs: "123.456" })).toBe(
      "123.456",
    );
  });
});

describe("parseResolvePrivateMetadata", () => {
  it("parses legacy metadata as a thread timestamp", () => {
    expect(parseResolvePrivateMetadata("123.456")).toStrictEqual({
      threadTs: "123.456",
    });
  });
});

describe("findResolutionCategoryOption", () => {
  it("matches by option label when the value differs", () => {
    expect(
      findResolutionCategoryOption(
        [
          {
            text: {
              text: "Joiner / Mover / Leaver (JML)",
            },
            value: "jml",
          },
        ],
        {
          category: "Joiner / Mover / Leaver (JML)",
        },
      ),
    ).toStrictEqual({
      text: {
        text: "Joiner / Mover / Leaver (JML)",
      },
      value: "jml",
    });
  });
});

describe("getResolutionCategories", () => {
  it("includes crime-specific resolution categories for crime", () => {
    expect(
      getResolutionCategories("crime").map((category) => category.text.text),
    ).toContain("Joiner / Mover / Leaver (JML)");
  });
});
