const { knowledgeSearchAnswerBlocks } = require("./knowledgeSearchAnswer");

describe("knowledgeSearchAnswerBlocks", () => {
  it("shows the answer and simple feedback buttons", () => {
    const blocks = knowledgeSearchAnswerBlocks({
      answer: "Use the runbook.",
      area: "other",
    });

    expect(blocks[0]).toEqual(
      expect.objectContaining({ block_id: "knowledge_search_context_other" }),
    );
    expect(blocks[1]).toEqual(
      expect.objectContaining({
        block_id: "knowledge_search_conversation_feedback_other",
      }),
    );
    expect(blocks[2].elements.map((element) => element.action_id)).toEqual([
      "knowledge_search_conversation_solved",
      "knowledge_search_conversation_needs_help",
    ]);
  });
});
