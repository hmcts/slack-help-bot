jest.mock("../modules/appInsights", () => ({
  trackEvent: jest.fn(),
}));

const { beginHelpRequest } = require("./beginHelpRequest");

describe("beginHelpRequest", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("posts the DM question guidance when no description is available", async () => {
    const client = {
      conversations: {
        open: jest.fn().mockResolvedValue({ channel: { id: "D1" } }),
      },
      chat: {
        postMessage: jest.fn().mockResolvedValue({ ok: true }),
      },
    };

    await beginHelpRequest({
      userId: "U1",
      client,
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "D1",
        text: expect.stringContaining("send me your question"),
      }),
    );
  });
});
