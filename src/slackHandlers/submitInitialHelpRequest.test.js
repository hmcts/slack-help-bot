jest.mock("./utils/aiCache", () => ({
  queryAi: jest.fn(),
}));

jest.mock("../modules/appInsights", () => ({
  trackEvent: jest.fn(),
}));

const { queryAi } = require("./utils/aiCache");
const { submitInitialHelpRequest } = require("./submitInitialHelpRequest");

describe("submitInitialHelpRequest", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("continues when a message action does not include modal state", async () => {
    queryAi.mockResolvedValue({
      relatedIssues: [],
      knowledgeStoreResults: [],
      aiRecommendation: {},
      followUpQuestions: [],
    });

    const client = {
      chat: {
        update: jest.fn().mockResolvedValue({ ok: true }),
      },
    };

    const body = {
      user: { id: "U123" },
      channel: { id: "C123" },
      message: {
        ts: "123.456",
        blocks: [
          {},
          {},
          { element: { initial_value: "summary" } },
          { element: { initial_value: "https://example.com" } },
          {},
          { element: { initial_value: "description" } },
          { element: { initial_value: "analysis" } },
        ],
      },
    };

    await expect(
      submitInitialHelpRequest(body, client, "initial", "other"),
    ).resolves.toBeUndefined();

    expect(client.chat.update).toHaveBeenCalled();
  });
});
