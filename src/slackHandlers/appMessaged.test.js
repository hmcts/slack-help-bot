jest.mock("../modules/appInsights", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("config", () => ({
  get: jest.fn((key) => key),
}));

jest.mock("../service/persistence", () => ({
  addCommentToHelpRequest: jest.fn(),
  extractJiraIdFromBlocks: jest.fn(),
}));

jest.mock("./utils/lookupUser", () => ({
  convertProfileToName: jest.fn(),
  lookupUsersName: jest.fn(),
}));

jest.mock("./assistant", () => ({
  handleAgentMessage: jest.fn(),
}));

const { appMessaged } = require("./appMessaged");
const { handleAgentMessage } = require("./assistant");

describe("appMessaged", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("routes help messages through the agent conversation", async () => {
    const say = jest.fn();
    const client = {};
    const event = {
      channel_type: "im",
      channel: "D1",
      user: "U1",
      text: "help",
    };

    await appMessaged(event, {}, client, say);

    expect(handleAgentMessage).toHaveBeenCalledWith({
      message: event,
      client,
    });
    expect(say).not.toHaveBeenCalled();
  });

  it("routes normal DM messages through the agent conversation", async () => {
    const say = jest.fn();
    const client = {};
    const event = {
      channel_type: "im",
      channel: "D1",
      user: "U1",
      text: "How do I find pipeline logs?",
    };

    await appMessaged(event, {}, client, say);

    expect(handleAgentMessage).toHaveBeenCalledWith({
      message: event,
      client,
    });
    expect(say).not.toHaveBeenCalled();
  });
});
