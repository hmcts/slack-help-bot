jest.mock("config", () => ({
  get: jest.fn((key) =>
    key.endsWith("report_channel_crime_id") ? "CRIME" : "OTHER",
  ),
}));

jest.mock("../service/persistence", () => ({
  createHelpRequest: jest.fn(),
  updateHelpRequestDescription: jest.fn(),
}));

jest.mock("../service/cosmos", () => ({
  createHelpRequestInCosmos: jest.fn(),
}));

jest.mock("./utils/lookupUser", () => ({
  lookupUsersEmail: jest.fn(),
}));

jest.mock("../modules/appInsights", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("uuidv7", () => ({ uuidv7: () => "uuid-1" }));

const {
  createHelpRequest,
  updateHelpRequestDescription,
} = require("../service/persistence");
const { createHelpRequestInCosmos } = require("../service/cosmos");
const { lookupUsersEmail } = require("./utils/lookupUser");
const {
  submitConversationalHelpRequest,
} = require("./submitConversationalHelpRequest");

describe("submitConversationalHelpRequest", () => {
  it("creates the Jira request, operations thread and conversational receipt", async () => {
    lookupUsersEmail.mockResolvedValue("user@example.com");
    createHelpRequest.mockResolvedValue("DTSPO-123");
    createHelpRequestInCosmos.mockResolvedValue(undefined);
    const client = {
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            channel: "OTHER",
            message: { ts: "200.000" },
          })
          .mockResolvedValue({ ok: true }),
        getPermalink: jest.fn().mockResolvedValue({
          permalink: "https://slack.example/help-request",
        }),
      },
    };
    const helpRequest = {
      summary: "Preview unavailable",
      description: "Preview returns 503",
      prBuildUrl: "",
      analysis: "Restarted the pod",
      environment: { text: { text: "Preview / Dev" }, value: "dev" },
      team: { text: { text: "CCD" }, value: "ccd" },
      area: { text: { text: "AKS" }, value: "aks" },
      followUpAnswers: [],
    };

    const result = await submitConversationalHelpRequest({
      client,
      userId: "U1",
      channelId: "D1",
      threadTs: "100.000",
      platformArea: "other",
      helpRequest,
    });

    expect(createHelpRequest).toHaveBeenCalledWith({
      summary: "Preview unavailable",
      userEmail: "user@example.com",
      labels: ["area-aks", "team-ccd", "platform-area-non-crime"],
    });
    expect(updateHelpRequestDescription).toHaveBeenCalledWith(
      "DTSPO-123",
      expect.objectContaining({
        description: "Preview returns 503",
        slackLink: "https://slack.example/help-request",
      }),
    );
    expect(client.chat.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        channel: "D1",
        thread_ts: "100.000",
        blocks: [
          expect.objectContaining({
            block_id: "help_request_conversation_complete",
          }),
        ],
      }),
    );
    expect(createHelpRequestInCosmos).toHaveBeenCalledWith(
      expect.objectContaining({ key: "DTSPO-123" }),
    );
    expect(result).toStrictEqual({
      jiraId: "DTSPO-123",
      permalink: "https://slack.example/help-request",
    });
  });
});
