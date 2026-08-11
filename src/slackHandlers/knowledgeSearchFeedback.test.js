jest.mock("../modules/appInsights", () => ({
  trackEvent: jest.fn(),
}));

const {
  getFeedbackContext,
  hasReadSuggestion,
  handleKnowledgeSearchReadSuggestion,
  handleKnowledgeSearchSolved,
  handleKnowledgeSearchStillNeedHelp,
} = require("./knowledgeSearchFeedback");

describe("knowledgeSearchFeedback", () => {
  const body = {
    user: { id: "U1" },
    channel: { id: "D1" },
    message: {
      ts: "123.456",
      text: "Use the runbook.",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Use the runbook.",
          },
        },
        {
          type: "actions",
          elements: [
            {
              action_id: "knowledge_search_still_need_help",
              value: JSON.stringify({
                area: "other",
                question: "How do I fix preview?",
              }),
            },
          ],
        },
      ],
    },
  };

  it("marks an answer as solved", async () => {
    const client = {
      chat: {
        update: jest.fn(),
      },
    };

    await handleKnowledgeSearchSolved(client, body, {
      value: JSON.stringify({
        area: "other",
        question: "How do I fix preview?",
      }),
    });

    const update = client.chat.update.mock.calls[0][0];

    expect(JSON.stringify(update.blocks)).toContain("Marked as solved");
    expect(JSON.stringify(update.blocks)).not.toContain("Raise help request");
  });

  it("asks the user to confirm they read the suggestion before showing ticket creation", async () => {
    const client = {
      chat: {
        update: jest.fn(),
      },
    };

    await handleKnowledgeSearchStillNeedHelp(client, body, {
      value: JSON.stringify({
        area: "other",
        question: "How do I fix preview?",
      }),
    });

    const update = client.chat.update.mock.calls[0][0];

    expect(JSON.stringify(update.blocks)).toContain(
      "Please confirm you have read the suggestion",
    );
    expect(JSON.stringify(update.blocks)).not.toContain("Raise help request");
  });

  it("starts the ticket form when the user still needs help and has read the suggestion", async () => {
    const client = {
      chat: {
        update: jest.fn(),
        postMessage: jest.fn().mockResolvedValue({ ok: true }),
      },
    };

    await handleKnowledgeSearchStillNeedHelp(
      client,
      {
        ...body,
        state: {
          values: {
            knowledge_search_read_suggestion_block: {
              knowledge_search_read_suggestion: {
                action_id: "knowledge_search_read_suggestion",
                selected_options: [{ value: "read_suggestion" }],
              },
            },
          },
        },
      },
      {
        value: JSON.stringify({
          area: "other",
          question: "How do I fix preview?",
        }),
      },
    );

    const update = client.chat.update.mock.calls[0][0];

    expect(JSON.stringify(update.blocks)).toContain(
      "Help request form started",
    );
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "D1",
        blocks: expect.arrayContaining([
          expect.objectContaining({
            element: expect.objectContaining({
              action_id: "description",
              initial_value: "How do I fix preview?",
            }),
          }),
        ]),
      }),
    );
  });

  it("starts the ticket form when the button payload records that the suggestion has been read", async () => {
    const client = {
      chat: {
        update: jest.fn(),
        postMessage: jest.fn().mockResolvedValue({ ok: true }),
      },
    };

    await handleKnowledgeSearchStillNeedHelp(client, body, {
      value: JSON.stringify({
        area: "other",
        question: "How do I fix preview?",
        hasReadSuggestion: true,
      }),
    });

    const update = client.chat.update.mock.calls[0][0];

    expect(JSON.stringify(update.blocks)).toContain(
      "Help request form started",
    );
    expect(client.chat.postMessage).toHaveBeenCalled();
  });

  it("starts the ticket form without checkbox confirmation when no suggestion was shown", async () => {
    const client = {
      chat: {
        update: jest.fn(),
        postMessage: jest.fn().mockResolvedValue({ ok: true }),
      },
    };

    await handleKnowledgeSearchStillNeedHelp(client, body, {
      value: JSON.stringify({
        area: "other",
        question: "How do I fix preview?",
        requiresReadConfirmation: false,
      }),
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "D1",
      }),
    );
  });

  it("updates the feedback message when the suggestion checkbox is selected", async () => {
    const client = {
      chat: {
        update: jest.fn(),
      },
    };

    await handleKnowledgeSearchReadSuggestion(client, body, {
      selected_options: [{ value: "read_suggestion" }],
    });

    const update = client.chat.update.mock.calls[0][0];
    const stillNeedHelpButton = update.blocks
      .flatMap((block) => block.elements ?? [])
      .find(
        (element) => element.action_id === "knowledge_search_still_need_help",
      );

    expect(JSON.parse(stillNeedHelpButton.value)).toEqual(
      expect.objectContaining({ hasReadSuggestion: true }),
    );
  });

  it("detects when the suggestion checkbox is selected", () => {
    expect(
      hasReadSuggestion({
        state: {
          values: {
            knowledge_search_read_suggestion_block: {
              knowledge_search_read_suggestion: {
                action_id: "knowledge_search_read_suggestion",
                selected_options: [{ value: "read_suggestion" }],
              },
            },
          },
        },
      }),
    ).toBe(true);
  });

  it("detects selected checkbox state when Slack omits action_id from the state value", () => {
    expect(
      hasReadSuggestion({
        state: {
          values: {
            knowledge_search_read_suggestion_block: {
              knowledge_search_read_suggestion: {
                type: "checkboxes",
                selected_options: [{ value: "read_suggestion" }],
              },
            },
          },
        },
      }),
    ).toBe(true);
  });

  it("reads the feedback context from the message button value", () => {
    expect(getFeedbackContext(body.message)).toStrictEqual({
      area: "other",
      question: "How do I fix preview?",
      hasReadSuggestion: false,
      requiresReadConfirmation: true,
    });
  });
});
