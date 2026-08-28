jest.mock("../service/persistence", () => ({
  updateIssueStatus: jest.fn(),
}));

const { updateIssueStatus } = require("../service/persistence");
const { handleStatusUpdate, isStatusCommand } = require("./statusUpdate");

describe("status update command", () => {
  beforeEach(() => jest.clearAllMocks());

  it("only recognizes commands at the beginning of a mention", () => {
    expect(isStatusCommand("status DTSPO-123 In Progress")).toBe(true);
    expect(isStatusCommand("help status-update DTSPO-123 Done")).toBe(true);
    expect(isStatusCommand("please check the status of this ticket")).toBe(
      false,
    );
  });

  it("updates Jira through the existing persistence integration", async () => {
    updateIssueStatus.mockResolvedValueOnce();
    const client = {
      chat: {
        postMessage: jest.fn(),
        postEphemeral: jest.fn(),
      },
    };

    await handleStatusUpdate(
      {
        user_id: "U1",
        channel_id: "C1",
        thread_ts: "123.456",
        text: "status DTSPO-123 In Progress",
      },
      client,
    );

    expect(updateIssueStatus).toHaveBeenCalledWith("DTSPO-123", "In Progress");
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: "123.456" }),
    );
  });
});
