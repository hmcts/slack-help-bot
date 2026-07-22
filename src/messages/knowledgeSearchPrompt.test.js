const { knowledgeSearchPromptBlocks } = require("./knowledgeSearchPrompt");

describe("knowledgeSearchPromptBlocks", () => {
  it("asks the user to choose a platform before searching", () => {
    const blocks = knowledgeSearchPromptBlocks();
    const buttons = blocks.find((block) => block.type === "actions")?.elements;

    expect(blocks[0].text.text).toContain(
      "I need to know what area you need help in",
    );
    expect(blocks[0].text.text).toContain("Crime / Common Platform - CPP");
    expect(blocks[0].text.text).toContain(
      "Cloud Native Platform (CFT, SDS) - Heritage & All Other Requests",
    );
    expect(buttons).toHaveLength(2);
    expect(buttons?.[0].action_id).toBe("search_knowledge_store_crime");
    expect(buttons?.[1].action_id).toBe("search_knowledge_store_non_crime");
  });
});
