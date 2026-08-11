const {
  knowledgeSearchAnswerBlocks,
  parseKnowledgeSearchActionValue,
} = require("./knowledgeSearchAnswer");

describe("knowledgeSearchAnswerBlocks", () => {
  it("asks for self-service feedback before showing ticket creation", () => {
    const blocks = knowledgeSearchAnswerBlocks({
      answer: "Use the runbook.",
      area: "other",
      question: "How do I fix preview?",
    });

    const actionBlocks = blocks.filter((block) => block.type === "actions");
    const checkbox = actionBlocks[0].elements[0];
    const buttons = actionBlocks[1];

    expect(checkbox).toEqual(
      expect.objectContaining({
        type: "checkboxes",
        action_id: "knowledge_search_read_suggestion",
      }),
    );
    expect(checkbox.options[0].text.text).toBe(
      "I have read the above suggestion",
    );
    expect(buttons.elements.map((element) => element.action_id)).toStrictEqual([
      "knowledge_search_solved",
      "knowledge_search_still_need_help",
    ]);
  });

  it("marks the request form as started after the user still needs help", () => {
    const blocks = knowledgeSearchAnswerBlocks({
      answer: "Use the runbook.",
      area: "crime",
      question: "How do I fix preview?",
      state: "needs_help",
    });

    const blockText = JSON.stringify(blocks);

    expect(blockText).toContain("Help request form started");
    expect(blockText).not.toContain("Raise help request");
  });

  it("preserves the checked state when the suggestion has been read", () => {
    const blocks = knowledgeSearchAnswerBlocks({
      answer: "Use the runbook.",
      area: "other",
      question: "How do I fix preview?",
      hasReadSuggestion: true,
    });

    const checkbox = blocks.find(
      (block) => block.block_id === "knowledge_search_read_suggestion_block",
    ).elements[0];
    const buttonValue = blocks
      .flatMap((block) => block.elements ?? [])
      .find(
        (element) => element.action_id === "knowledge_search_still_need_help",
      ).value;

    expect(checkbox.initial_options).toStrictEqual([checkbox.options[0]]);
    expect(parseKnowledgeSearchActionValue(buttonValue)).toStrictEqual({
      area: "other",
      question: "How do I fix preview?",
      hasReadSuggestion: true,
      requiresReadConfirmation: true,
    });
  });

  it("does not show the read suggestion checkbox when no documentation results were found", () => {
    const blocks = knowledgeSearchAnswerBlocks({
      answer: "I could not find that in the documentation.",
      area: "other",
      question: "How do I fix preview?",
      requiresReadConfirmation: false,
    });

    const blockText = JSON.stringify(blocks);
    const stillNeedHelpButton = blocks
      .flatMap((block) => block.elements ?? [])
      .find(
        (element) => element.action_id === "knowledge_search_still_need_help",
      );

    expect(blockText).not.toContain("I have read the above suggestion");
    expect(parseKnowledgeSearchActionValue(stillNeedHelpButton.value)).toEqual(
      expect.objectContaining({
        requiresReadConfirmation: false,
      }),
    );
  });
});

describe("parseKnowledgeSearchActionValue", () => {
  it("parses feedback button values", () => {
    expect(
      parseKnowledgeSearchActionValue(
        JSON.stringify({
          area: "crime",
          question: "How do I fix preview?",
        }),
      ),
    ).toStrictEqual({
      area: "crime",
      question: "How do I fix preview?",
      hasReadSuggestion: false,
      requiresReadConfirmation: true,
    });
  });
});
