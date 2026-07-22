jest.mock("../service/searchKnowledgeStore", () => ({
  searchKnowledgeStore: jest.fn(),
}));

jest.mock("../ai/ai", () => ({
  answerFromKnowledgeStore: jest.fn(),
}));

const {
  searchKnowledgeStore,
} = require("../service/searchKnowledgeStore");
const { answerFromKnowledgeStore } = require("../ai/ai");
const {
  setPendingKnowledgeSearch,
  clearPendingKnowledgeSearch,
} = require("./utils/pendingKnowledgeSearch");
const {
  handleKnowledgeSearchPlatformSelection,
} = require("./searchKnowledgeStoreSelection");

describe("handleKnowledgeSearchPlatformSelection", () => {
  const client = {
    chat: {
      update: jest.fn(),
      postMessage: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    clearPendingKnowledgeSearch({ channelId: "C1", userId: "U1" });
  });

  it("searches using the stored question and posts a help request button", async () => {
    setPendingKnowledgeSearch({
      channelId: "C1",
      userId: "U1",
      question: "How do I find related tickets?",
    });
    searchKnowledgeStore.mockResolvedValue([]);
    answerFromKnowledgeStore.mockResolvedValue({
      answer: "Try the docs.",
      sourceIndexes: [],
    });

    await handleKnowledgeSearchPlatformSelection(
      client,
      {
        channel: { id: "C1" },
        user: { id: "U1" },
        message: { ts: "123.456" },
      },
      "other",
    );

    expect(searchKnowledgeStore).toHaveBeenCalledWith(
      "How do I find related tickets?",
      "other",
    );
    expect(answerFromKnowledgeStore).toHaveBeenCalledWith(
      "How do I find related tickets?",
      [],
      "other",
    );
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C1",
        blocks: expect.any(Array),
      }),
    );
  });
});
