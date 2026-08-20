const { knowledgeSearchPromptBlocks } = require("./knowledgeSearchPrompt");

describe("knowledgeSearchPromptBlocks", () => {
  it("offers the two platform choices as buttons", () => {
    const blocks = knowledgeSearchPromptBlocks();

    expect(blocks[0].block_id).toBe(
      "knowledge_search_conversation_platform_prompt",
    );
    expect(blocks[1].elements.map((element) => element.action_id)).toEqual([
      "knowledge_search_conversation_platform_crime",
      "knowledge_search_conversation_platform_other",
    ]);
  });
});
