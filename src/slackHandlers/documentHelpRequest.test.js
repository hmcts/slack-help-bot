jest.mock("../service/persistence", () => ({
  extractJiraIdFromBlocks: jest.fn(),
  resolveHelpRequest: jest.fn(),
  addCommentToHelpRequestResolve: jest.fn(),
  addLabel: jest.fn(),
}));

jest.mock("../service/cosmos", () => ({
  updateCosmosWhenHelpRequestResolved: jest.fn(),
}));

const {
  getDocumentationFromView,
  getDocumentRequestKey,
  isHelpRequestAlreadyDone,
} = require("./documentHelpRequest");

describe("getDocumentationFromView", () => {
  it("uses the selected category when present", () => {
    expect(
      getDocumentationFromView({
        private_metadata:
          '{"thread_ts":"123.456","suggested_category":"self-service gap","suggested_category_label":"Self-Service Gap","suggested_resolution":"Suggested resolution"}',
        state: {
          values: {
            category_block: {
              category: {
                selected_option: {
                  value: "incident / one-off platform failure",
                  text: {
                    text: "Incident / One-Off Platform Failure",
                  },
                },
              },
            },
            how_block: {
              how: {
                value: "Resolved by restarting the failed job.",
              },
            },
          },
        },
      }),
    ).toStrictEqual({
      category: "Incident / One-Off Platform Failure",
      how: "Resolved by restarting the failed job.",
    });
  });

  it("falls back to AI suggestions when Slack submits stale empty input state", () => {
    expect(
      getDocumentationFromView({
        private_metadata:
          '{"thread_ts":"123.456","suggested_category":"incident / one-off platform failure","suggested_category_label":"Incident / One-Off Platform Failure","suggested_resolution":"Resolved by restarting the failed job."}',
        state: {
          values: {
            category_block: {
              category: {
                selected_option: null,
              },
            },
            how_block: {
              how: {
                value: "",
              },
            },
          },
        },
      }),
    ).toStrictEqual({
      category: "Incident / One-Off Platform Failure",
      how: "Resolved by restarting the failed job.",
    });
  });

  it("reads pending fields when the modal is submitted before AI suggestions load", () => {
    expect(
      getDocumentationFromView({
        private_metadata: "123.456",
        state: {
          values: {
            category_block_pending: {
              category_pending: {
                selected_option: {
                  value: "self-service gap",
                  text: {
                    text: "Self-Service Gap",
                  },
                },
              },
            },
            how_block_pending: {
              how_pending: {
                value: "User was shown the existing self-service route.",
              },
            },
          },
        },
      }),
    ).toStrictEqual({
      category: "Self-Service Gap",
      how: "User was shown the existing self-service route.",
    });
  });
});

describe("getDocumentRequestKey", () => {
  it("creates a stable key for the area and thread", () => {
    expect(getDocumentRequestKey({ area: "other", threadTs: "123.456" })).toBe(
      "other:123.456",
    );
  });
});

describe("isHelpRequestAlreadyDone", () => {
  it("returns true when the root help request block is already done", () => {
    expect(
      isHelpRequestAlreadyDone([
        {},
        {},
        {
          fields: [
            {
              text: "Status :snowflake:\n Done",
            },
          ],
        },
      ]),
    ).toBe(true);
  });

  it("returns false when the root help request block is not done", () => {
    expect(
      isHelpRequestAlreadyDone([
        {},
        {},
        {
          fields: [
            {
              text: "Status :eyes:\n In Progress",
            },
          ],
        },
      ]),
    ).toBe(false);
  });
});
