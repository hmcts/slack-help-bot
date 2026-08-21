jest.mock("./conversationIntent", () => ({
  understandConversationTurn: jest.fn(),
}));

const { understandConversationTurn } = require("./conversationIntent");
const { orchestrateConversation } = require("./conversationOrchestrator");

describe("conversation orchestrator", () => {
  beforeEach(() => jest.resetAllMocks());

  it("returns polite replies for greeting and off-topic intent", async () => {
    understandConversationTurn.mockResolvedValueOnce({
      intent: "greeting",
      response: "Hello — which platform do you need help with?",
    });
    await expect(
      orchestrateConversation({ question: "hello" }),
    ).resolves.toEqual(expect.objectContaining({ action: "reply" }));
    understandConversationTurn.mockResolvedValueOnce({
      intent: "off_topic",
      response: "I can help with HMCTS Platform Operations queries.",
    });
    await expect(
      orchestrateConversation({ question: "tell me a joke" }),
    ).resolves.toEqual(expect.objectContaining({ action: "reply" }));
  });

  it("keeps platform selections on the validated workflow", async () => {
    await expect(
      orchestrateConversation({ question: "Crime / CPP", pendingPlatform: {} }),
    ).resolves.toEqual({ action: "platform_answer" });
    expect(understandConversationTurn).not.toHaveBeenCalled();
  });

  it("does not repeat a greeting already shown in the thread", async () => {
    understandConversationTurn.mockResolvedValue({ intent: "greeting" });
    await expect(
      orchestrateConversation({ question: "hi", greetingShown: true }),
    ).resolves.toEqual({ action: "platform_related" });
  });
});
