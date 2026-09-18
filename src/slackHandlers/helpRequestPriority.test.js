jest.mock("config", () => ({
  get: jest.fn((key) => (key === "slack.bau_user_group_id" ? "SBAU" : "")),
  has: jest.fn(() => false),
}));
jest.mock("../ai/ai", () => ({ assessPriority: jest.fn() }));
jest.mock("../service/persistence", () => ({
  extractJiraIdFromBlocks: jest.fn(() => "DTSPO-1"),
  updateHelpRequestPriority: jest.fn(),
}));
jest.mock("../service/cosmos", () => ({
  updateHelpRequestPriorityInCosmos: jest.fn(),
}));
jest.mock("../modules/appInsights", () => ({ trackEvent: jest.fn() }));

const { assessPriority } = require("../ai/ai");
const { updateHelpRequestPriority } = require("../service/persistence");
const { updateHelpRequestPriorityInCosmos } = require("../service/cosmos");
const {
  getPriorityFromBlocks,
  setPriorityInBlocks,
  monitorThreadPriority,
  formatRecentThreadMessages,
  changeHelpRequestPriority,
} = require("./helpRequestPriority");

describe("help request priority blocks", () => {
  const blocks = [
    {
      fields: [
        { type: "mrkdwn", text: "*Status* :fire:  \n Open" },
        { type: "mrkdwn", text: "*Priority* :rotating_light: \n High" },
      ],
    },
  ];

  it("reads the current priority from the root request", () => {
    expect(getPriorityFromBlocks(blocks)).toBe("high");
  });

  it("updates the displayed priority without changing the input", () => {
    const updated = setPriorityInBlocks(structuredClone(blocks), "critical");
    expect(getPriorityFromBlocks(updated)).toBe("critical");
    expect(getPriorityFromBlocks(blocks)).toBe("high");
  });

  it("adds priority metadata to requests created before this feature", () => {
    const legacyBlocks = [{ fields: [{ text: "*Status* :fire:  \n Open" }] }];
    const updated = setPriorityInBlocks(legacyBlocks, "high");
    expect(getPriorityFromBlocks(updated)).toBe("high");
  });
});

describe("thread priority monitoring", () => {
  const rootMessage = {
    ts: "100.1",
    text: "New platform help request raised",
    blocks: [
      { type: "section", text: { text: "*Deployments failing*" } },
      {
        fields: [{ text: "*Priority* :rotating_light: \n Normal" }],
      },
    ],
  };

  beforeEach(() => jest.clearAllMocks());

  it("uses a bounded window of human thread messages", () => {
    const messages = [
      { text: "ignored bot message", bot_id: "B1" },
      ...Array.from({ length: 22 }, (_, index) => ({ text: `reply ${index}` })),
    ];
    const context = formatRecentThreadMessages(messages, "fallback");

    expect(context).not.toContain("ignored bot message");
    expect(context).not.toContain("reply 0\n");
    expect(context).toContain("reply 21");
  });

  it("raises priority and notifies BAU when new impact is reported", async () => {
    assessPriority.mockResolvedValue({
      priority: "high",
      confidence: "high",
      reasons: ["multiple teams are affected"],
    });
    updateHelpRequestPriority.mockResolvedValue(true);
    const client = {
      chat: { update: jest.fn(), postMessage: jest.fn() },
    };

    await monitorThreadPriority({
      event: {
        channel: "C1",
        text: "This is now affecting three teams",
      },
      rootMessage,
      client,
    });

    expect(updateHelpRequestPriority).toHaveBeenCalledWith("DTSPO-1", "high");
    expect(updateHelpRequestPriorityInCosmos).toHaveBeenCalled();
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        thread_ts: "100.1",
        text: expect.stringContaining("<!subteam^SBAU>"),
      }),
    );
  });

  it("does not change priority when the evidence is low confidence", async () => {
    assessPriority.mockResolvedValue({
      priority: "high",
      confidence: "low",
      reasons: ["urgent wording"],
    });

    await monitorThreadPriority({
      event: { channel: "C1", text: "Please fix this urgently!!!" },
      rootMessage,
      client: { chat: { update: jest.fn(), postMessage: jest.fn() } },
    });

    expect(updateHelpRequestPriority).not.toHaveBeenCalled();
  });
});

describe("manual priority changes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports a Jira rejection without throwing from the Slack action", async () => {
    updateHelpRequestPriority.mockResolvedValue(false);
    const client = {
      chat: {
        update: jest.fn(),
        postMessage: jest.fn(),
        postEphemeral: jest.fn(),
      },
    };

    await changeHelpRequestPriority(
      { selected_option: { value: "high" } },
      {
        channel: { id: "C1" },
        user: { id: "U1" },
        message: {
          ts: "100.1",
          blocks: [
            { fields: [{ text: "*Priority* :rotating_light: \n Normal" }] },
          ],
        },
      },
      client,
    );

    expect(client.chat.postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "U1",
        text: expect.stringContaining("Jira rejected"),
      }),
    );
    expect(client.chat.update).not.toHaveBeenCalled();
  });
});
