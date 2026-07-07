const {
  extractTextFromBlock,
  extractThreadText,
  toSuggestedCategory,
  updateResolveModal,
} = require("./resolveHelpRequest");
const {
  parseResolvePrivateMetadata,
} = require("../messages/helpRequestResolve");

describe("extractTextFromBlock", () => {
  it("extracts text from Slack section fields and elements", () => {
    expect(
      extractTextFromBlock({
        text: {
          type: "mrkdwn",
          text: "New platform help request raised",
        },
        fields: [
          {
            type: "mrkdwn",
            text: "*Summary*\nJenkins build failing at functional test",
          },
        ],
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Resolve",
            },
          },
        ],
      }),
    ).toContain("Jenkins build failing at functional test");
  });
});

describe("extractThreadText", () => {
  it("extracts message text and block text", () => {
    expect(
      extractThreadText([
        {
          text: "Thread reply",
          blocks: [
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: "*Resolution*\nRestarted the failing test job",
                },
              ],
            },
          ],
        },
      ]),
    ).toStrictEqual([
      "Thread reply\n*Resolution*\nRestarted the failing test job",
    ]);
  });
});

describe("toSuggestedCategory", () => {
  it("returns null for unknown categories", () => {
    expect(
      toSuggestedCategory({
        category: "Unknown",
        confidence: "low",
      }),
    ).toBeNull();
  });

  it("keeps known categories", () => {
    expect(
      toSuggestedCategory({
        category: "Missing / Inadequate Docs",
        confidence: "high",
      }),
    ).toStrictEqual({
      category: "Missing / Inadequate Docs",
      confidence: "high",
    });
  });
});

describe("updateResolveModal", () => {
  it("updates the existing modal by view id and hash", async () => {
    const update = jest.fn().mockResolvedValue({});

    await updateResolveModal({
      client: {
        views: {
          update,
        },
      },
      view: {
        id: "V123",
        hash: "hash",
      },
      threadTs: "123.456",
      area: "other",
      suggestedResolution: "Resolved by updating the pipeline config.",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        view_id: "V123",
        hash: "hash",
      }),
    );
    expect(
      parseResolvePrivateMetadata(
        update.mock.calls[0][0].view.private_metadata,
      ),
    ).toStrictEqual({
      threadTs: "123.456",
      suggestedResolution: "Resolved by updating the pipeline config.",
    });
  });
});
