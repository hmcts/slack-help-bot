jest.mock("./searchKnowledgeStore", () => ({
  searchKnowledgeStore: jest.fn(),
}));
jest.mock("../ai/ai", () => ({
  answerFromKnowledgeStore: jest.fn(),
  rewriteKnowledgeSearchQuery: jest.fn(),
}));

const { searchKnowledgeStore } = require("./searchKnowledgeStore");
const {
  answerFromKnowledgeStore,
  rewriteKnowledgeSearchQuery,
} = require("../ai/ai");
const { answerConversation } = require("./conversationKnowledge");

describe("answerConversation", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("searches a standalone query and answers with conversation context", async () => {
    const conversation = [
      { role: "user", content: "How do I create a preview?" },
      { role: "assistant", content: "Use the preview pipeline." },
    ];
    rewriteKnowledgeSearchQuery.mockResolvedValue(
      "Where is the preview pipeline?",
    );
    searchKnowledgeStore.mockResolvedValue([]);
    answerFromKnowledgeStore.mockResolvedValue({
      answer: "I couldn't find an answer in the documentation.",
      sourceIndexes: [],
    });

    const result = await answerConversation({
      question: "Where is it?",
      area: "other",
      conversation,
    });

    expect(searchKnowledgeStore).toHaveBeenCalledWith(
      "Where is the preview pipeline?",
      "other",
    );
    expect(answerFromKnowledgeStore).toHaveBeenCalledWith(
      "Where is it?",
      [],
      "other",
      conversation,
    );
    expect(result.requiresReadConfirmation).toBe(false);
    expect(result.resultCount).toBe(0);
  });

  it("uses the latest message if query rewriting fails", async () => {
    rewriteKnowledgeSearchQuery.mockRejectedValue(new Error("Unavailable"));
    searchKnowledgeStore.mockResolvedValue([]);
    answerFromKnowledgeStore.mockResolvedValue({
      answer: "No result.",
      sourceIndexes: [],
    });

    await answerConversation({
      question: "How do I deploy?",
      area: "crime",
      conversation: [{ role: "user", content: "Earlier context" }],
    });

    expect(searchKnowledgeStore).toHaveBeenCalledWith(
      "How do I deploy?",
      "crime",
    );
  });
});
