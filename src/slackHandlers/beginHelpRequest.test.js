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

  it("posts a prefilled form when a DM documentation answer supplies a description", async () => {
    const client = {
      conversations: {
        open: jest.fn().mockResolvedValue({ channel: { id: "D1" } }),
      },
      chat: {
        postMessage: jest.fn().mockResolvedValue({ ok: true }),
        update: jest.fn(),
      },
    };

    await beginHelpRequest({
      userId: "U1",
      client,
      area: "other",
      ts: "123.456",
      initialDescription: "The deployment is failing in preview.",
    });

    expect(client.chat.update).not.toHaveBeenCalled();
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "D1",
        blocks: expect.arrayContaining([
          expect.objectContaining({
            element: expect.objectContaining({
              action_id: "description",
              initial_value: "The deployment is failing in preview.",
            }),
          }),
        ]),
      }),
    );
  });
});
