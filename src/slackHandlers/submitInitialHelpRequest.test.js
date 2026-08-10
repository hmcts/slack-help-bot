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

  it("skips the knowledge-store lookup when the form came from a DM documentation answer", async () => {
    queryAi.mockResolvedValue({
      relatedIssues: [
        {
          title: "Deployment failed in preview",
          status: "Open",
          created_at: new Date("2025-01-01T12:00:00.000Z"),
          url: "https://example.com/SBOX-1",
          key: "SBOX-1",
        },
      ],
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
          { block_id: "help_form_source_knowledge_search" },
          {},
          { element: { initial_value: "summary" } },
          { element: { initial_value: "" } },
          {},
          { element: { initial_value: "description from original DM" } },
          { element: { initial_value: "" } },
        ],
      },
    };

    await submitInitialHelpRequest(body, client, "initial", "other");

    expect(queryAi).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "description from original DM",
      }),
      "other",
      { skipKnowledgeStore: true },
    );

    const finalUpdate = client.chat.update.mock.calls.at(-1)[0];
    const blockText = JSON.stringify(finalUpdate.blocks);

    expect(blockText).toContain("Deployment failed in preview");
    expect(blockText).not.toContain("Suggestions from documentation");
  });
});
