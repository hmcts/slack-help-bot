jest.mock("../ai/ai", () => ({
  suggestResolutionDocumentation: jest.fn(),
}));
jest.mock("config", () => ({
  get: jest.fn((key) => key),
}));

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
  it("normalizes legacy unknown categories to Other", () => {
    expect(
      toSuggestedCategory({
        category: "Unknown",
        confidence: "low",
      }),
    ).toStrictEqual({
      category: "Other",
      subCategory: "Insufficient Evidence",
      confidence: "low",
    });
  });

  it("rejects a sub-category that does not belong to the category", () => {
    expect(
      toSuggestedCategory({
        category: "Platform Access",
        subCategory: "Database Updates",
        confidence: "high",
      }),
    ).toStrictEqual({
      category: "Platform Access",
      subCategory: "Other",
      confidence: "high",
    });
  });

  it("keeps known categories", () => {
    expect(
      toSuggestedCategory({
        category: "Missing / Inadequate Docs",
        confidence: "high",
      }),
    ).toStrictEqual({
      category: "Missing / Inadequate Docs",
      subCategory: "Other",
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
      suggestedCategory: {
        category: "Platform One-Off Failure",
        subCategory: "Application Gateway",
        confidence: "high",
      },
      suggestedSubCategory: "Application Gateway",
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
      suggestedCategory: "platform one-off failure",
      suggestedCategoryLabel: "Platform One-Off Failure",
      suggestedSubCategory: "Application Gateway",
      suggestedResolution: "Resolved by updating the pipeline config.",
    });
  });
});
