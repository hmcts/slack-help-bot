jest.mock("../modules/appInsights", () => ({
  trackEvent: jest.fn(),
}));

const { startHelpForm } = require("./startHelpForm");

describe("startHelpForm", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("updates legacy help form buttons with the DM question guidance", async () => {
    const client = {
      chat: {
        update: jest.fn().mockResolvedValue({ ok: true }),
        postMessage: jest.fn(),
      },
    };

    await startHelpForm(
      client,
      {
        channel: { id: "D1" },
        user: { id: "U1" },
        message: { ts: "123.456" },
      },
      "other",
    );

    expect(client.chat.postMessage).not.toHaveBeenCalled();
    expect(client.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "D1",
        ts: "123.456",
        text: expect.stringContaining("send me your question"),
        blocks: expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              text: expect.stringContaining("send me your question"),
            }),
          }),
        ]),
      }),
    );
  });
});
