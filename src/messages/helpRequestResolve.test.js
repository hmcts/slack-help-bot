const {
  CATEGORY_BLOCK_ID,
  CATEGORY_PENDING_BLOCK_ID,
  createResolvePrivateMetadata,
  findResolutionCategoryOption,
  getResolutionCategories,
  getResolutionSubCategories,
  HOW_BLOCK_ID,
  HOW_PENDING_BLOCK_ID,
  helpRequestResolveBlocks,
  parseResolvePrivateMetadata,
  SUBCATEGORY_BLOCK_ID,
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
        category: "Platform One-Off Failure",
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
        category: "Platform One-Off Failure",
        confidence: "high",
      },
      suggestedResolution: "The failing job was restarted.",
    });

    expect(parseResolvePrivateMetadata(view.private_metadata)).toStrictEqual({
      threadTs: "123.456",
      suggestedCategory: "platform one-off failure",
      suggestedCategoryLabel: "Platform One-Off Failure",
      suggestedResolution: "The failing job was restarted.",
    });
  });

  it("shows only sub-categories valid for the suggested category", () => {
    const view = helpRequestResolveBlocks({
      thread_ts: "123.456",
      area: "other",
      suggestedCategory: {
        category: "Platform One-Off Failure",
        confidence: "high",
      },
      suggestedSubCategory: "Application Gateway",
    });
    const subCategoryBlock = view.blocks.find(
      (block) => block.block_id === SUBCATEGORY_BLOCK_ID,
    );
    const labels = subCategoryBlock.element.options.map(
      (option) => option.text.text,
    );

    expect(labels).toContain("Application Gateway");
    expect(labels).not.toContain("Database Updates");
    expect(subCategoryBlock.element.initial_option.text.text).toBe(
      "Application Gateway",
    );
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
  it("includes Platform Access as a standard resolution category", () => {
    const categories = getResolutionCategories("other").map(
      (category) => category.text.text,
    );

    expect(categories).toContain("Platform Access");
    expect(categories).toContain("Local Setup");
    expect(categories).toContain("Service Misconfiguration");
    expect(categories).toContain("Other");
    expect(categories).toContain("Withdrawn / Duplicate");
    expect(categories).not.toContain("Network Failure");
    expect(categories).not.toContain("Other Service / Team Issue");
  });

  it("uses Platform Access instead of a standalone JML category", () => {
    const categories = getResolutionCategories("crime").map(
      (category) => category.text.text,
    );

    expect(categories).toContain("Platform Access");
    expect(categories).not.toContain("Joiner / Mover / Leaver (JML)");
    expect(categories).toContain("Release Support");
  });
});

describe("getResolutionSubCategories", () => {
  it("returns a category-specific list", () => {
    expect(getResolutionSubCategories("Policy / Process Ambiguity")).toContain(
      "Access Governance",
    );
    expect(
      getResolutionSubCategories("Policy / Process Ambiguity"),
    ).not.toContain("Certificates");
  });
});
