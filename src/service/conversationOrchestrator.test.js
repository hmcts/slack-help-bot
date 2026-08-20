jest.mock("./conversationIntent", () => ({
  classifyConversationIntent: jest.fn(),
}));

const { classifyConversationIntent } = require("./conversationIntent");
const { orchestrateConversation } = require("./conversationOrchestrator");

describe("conversation orchestrator", () => {
  beforeEach(() => jest.resetAllMocks());

  it("returns polite replies for greeting and off-topic intent", async () => {
    classifyConversationIntent.mockResolvedValueOnce("greeting");
    await expect(
      orchestrateConversation({ question: "hello" }),
    ).resolves.toEqual(expect.objectContaining({ action: "reply" }));
    classifyConversationIntent.mockResolvedValueOnce("off_topic");
    await expect(
      orchestrateConversation({ question: "tell me a joke" }),
    ).resolves.toEqual(expect.objectContaining({ action: "reply" }));
  });

  it("keeps platform selections on the validated workflow", async () => {
    await expect(
      orchestrateConversation({ question: "Crime / CPP", pendingPlatform: {} }),
    ).resolves.toEqual({ action: "platform_answer" });
    expect(classifyConversationIntent).not.toHaveBeenCalled();
  });
});
