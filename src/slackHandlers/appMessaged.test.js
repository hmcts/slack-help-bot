jest.mock("../modules/appInsights", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("../service/persistence", () => ({
  addCommentToHelpRequest: jest.fn(),
  extractJiraIdFromBlocks: jest.fn(),
}));

jest.mock("./utils/lookupUser", () => ({
  convertProfileToName: jest.fn(),
  lookupUsersName: jest.fn(),
}));

const { appMessaged } = require("./appMessaged");

describe("appMessaged", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("tells the user to send their question when they send help in a DM", async () => {
    const say = jest.fn();

    await appMessaged(
      {
        channel_type: "im",
        channel: "D1",
        user: "U1",
        text: "help",
      },
      {},
      {},
      say,
    );

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Send me your question in this DM to get started.",
      }),
    );
  });

  it("keeps normal DM messages routed to knowledge search", async () => {
    const say = jest.fn();

    await appMessaged(
      {
        channel_type: "im",
        channel: "D1",
        user: "U1",
        text: "How do I find pipeline logs?",
      },
      {},
      {},
      say,
    );

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Which platform should I search?",
      }),
    );
  });
});
