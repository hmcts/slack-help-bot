jest.mock("../service/searchKnowledgeStore", () => ({
  searchKnowledgeStore: jest.fn(),
}));

jest.mock("../ai/ai", () => ({
  answerFromKnowledgeStore: jest.fn(),
}));

const { searchKnowledgeStore } = require("../service/searchKnowledgeStore");
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

  it("searches using the stored question and skips read confirmation when no docs are found", async () => {
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
        blocks: expect.arrayContaining([
          expect.objectContaining({
            elements: expect.arrayContaining([
              expect.objectContaining({
                action_id: "knowledge_search_still_need_help",
                value: JSON.stringify({
                  area: "other",
                  question: "How do I find related tickets?",
                  requiresReadConfirmation: false,
                }),
              }),
            ]),
          }),
        ]),
      }),
    );
    expect(
      JSON.stringify(client.chat.postMessage.mock.calls[0][0].blocks),
    ).not.toContain("I have read the above suggestion");
  });

  it("skips read confirmation when docs are found but the AI does not cite a source", async () => {
    setPendingKnowledgeSearch({
      channelId: "C1",
      userId: "U1",
      question: "How do I fix preview?",
    });
    searchKnowledgeStore.mockResolvedValue([
      {
        document: {
          title: "Unrelated guide",
          metadata_storage_path:
            "https://example.com/the-hmcts-way/unrelated.html",
        },
      },
    ]);
    answerFromKnowledgeStore.mockResolvedValue({
      answer: "I couldn't find an answer in the documentation.",
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

    const blocks = client.chat.postMessage.mock.calls[0][0].blocks;
    const stillNeedHelpButton = blocks
      .flatMap((block) => block.elements ?? [])
      .find(
        (element) => element.action_id === "knowledge_search_still_need_help",
      );

    expect(JSON.stringify(blocks)).not.toContain(
      "I have read the above suggestion",
    );
    expect(JSON.parse(stillNeedHelpButton.value)).toEqual(
      expect.objectContaining({
        requiresReadConfirmation: false,
      }),
    );
  });
});
