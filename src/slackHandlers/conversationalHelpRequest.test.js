jest.mock("../modules/appInsights", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("./submitConversationalHelpRequest", () => ({
  submitConversationalHelpRequest: jest.fn(),
}));

const {
  submitConversationalHelpRequest,
} = require("./submitConversationalHelpRequest");
const {
  buildState,
  findActiveSession,
  handleConversationalHelpReply,
  handleConversationalHelpAction,
  startConversationalHelpRequest,
  validateAnswer,
} = require("./conversationalHelpRequest");

function markedBot(ts, blockId, metadata) {
  return {
    ts,
    bot_id: "B1",
    text: blockId,
    blocks: [{ type: "section", block_id: blockId }],
    metadata,
  };
}

function user(ts, text) {
  return { ts, user: "U1", text };
}

describe("conversational help requests", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("starts an unclassified request by asking for the platform", async () => {
    const client = {
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValueOnce({ ts: "100.000" })
          .mockResolvedValue({}),
      },
    };

    await startConversationalHelpRequest({
      client,
      channelId: "D1",
      threadTs: "90.000",
    });

    expect(client.chat.postMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        channel: "D1",
        thread_ts: "90.000",
        blocks: expect.arrayContaining([
          expect.objectContaining({
            block_id: "help_request_conversation_prompt_platformArea",
          }),
          expect.objectContaining({ type: "actions" }),
        ]),
      }),
    );
    const platformButtons =
      client.chat.postMessage.mock.calls[1][0].blocks.find(
        (block) => block.type === "actions",
      ).elements;
    expect(platformButtons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.objectContaining({ type: "plain_text" }),
        }),
      ]),
    );
  });

  it("uses the original knowledge question as the description", () => {
    const messages = [
      markedBot("1", "help_request_conversation_start_other", {
        event_payload: {
          area: "other",
          initial_description: "Preview deployment is failing",
        },
      }),
      markedBot("2", "help_request_conversation_prompt_summary"),
      user("3", "Preview deployment failure"),
    ];
    const session = findActiveSession(messages);

    expect(buildState(messages, session)).toEqual(
      expect.objectContaining({
        summary: "Preview deployment failure",
        description: "Preview deployment is failing",
        platformArea: expect.objectContaining({ value: "other" }),
      }),
    );
  });

  it("uses a generated draft and skips summary and description questions", async () => {
    const client = {
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValueOnce({ ts: "100.000" })
          .mockResolvedValue({}),
      },
    };

    await startConversationalHelpRequest({
      client,
      channelId: "D1",
      threadTs: "90.000",
      area: "other",
      initialSummary: "Preview deployment returns HTTP 503",
      initialDescription: "The payments preview deployment returns HTTP 503.",
      initialPrBuildUrl: "https://github.com/hmcts/repo/pull/42",
      initialAnalysis: "Checked the deployment and pod logs.",
      initialRecommendations: {
        environment: "Preview / Dev",
        team: "CCD",
        area: "AKS",
      },
    });

    expect(client.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: "A few final details before review.",
        blocks: [
          expect.objectContaining({
            block_id: "help_request_conversation_start_other",
          }),
        ],
      }),
    );
    expect(client.chat.postMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({
            block_id: "help_request_conversation_prompt_confirmation",
          }),
          expect.objectContaining({ type: "actions" }),
        ]),
      }),
    );
  });

  it("defaults environment to N/A when AI cannot determine it", async () => {
    const client = {
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValueOnce({ ts: "100.000" })
          .mockResolvedValue({}),
      },
    };

    await startConversationalHelpRequest({
      client,
      channelId: "D1",
      threadTs: "90.000",
      area: "other",
      initialSummary: "Preview deployment returns HTTP 503",
      initialDescription: "The payments preview deployment returns HTTP 503.",
      initialAnalysis: "Checked the deployment logs.",
    });

    expect(client.chat.postMessage.mock.calls[0][0].metadata).toEqual(
      expect.objectContaining({
        event_payload: expect.objectContaining({
          initial_environment: "not-applicable",
        }),
      }),
    );
    expect(client.chat.postMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            block_id: "help_request_conversation_prompt_team",
          }),
        ],
      }),
    );
    expect(
      client.chat.postMessage.mock.calls.some(([message]) =>
        message.text?.includes("PR, build, pipeline"),
      ),
    ).toBe(false);
    expect(client.chat.postMessage.mock.calls[0][0].blocks).toHaveLength(1);
  });

  it("falls back to a typed prompt when Slack rejects interactive blocks", async () => {
    const client = {
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValueOnce({ ts: "100.000" })
          .mockRejectedValueOnce(new Error("invalid_blocks"))
          .mockResolvedValueOnce({}),
      },
    };

    await startConversationalHelpRequest({
      client,
      channelId: "D1",
      threadTs: "90.000",
      area: "other",
      initialSummary: "Preview deployment returns HTTP 503",
      initialDescription: "The payments preview deployment returns HTTP 503.",
      initialAnalysis: "Checked the deployment logs.",
    });

    expect(client.chat.postMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        text: expect.stringContaining("Which team owns"),
        blocks: [
          expect.objectContaining({
            block_id: "help_request_conversation_prompt_team",
          }),
        ],
      }),
    );
  });

  it("keeps edit controls on a fallback review", async () => {
    const client = {
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValueOnce({ ts: "100.000" })
          .mockRejectedValueOnce(new Error("invalid_blocks"))
          .mockResolvedValueOnce({}),
      },
    };

    await startConversationalHelpRequest({
      client,
      channelId: "D1",
      threadTs: "90.000",
      area: "other",
      initialSummary: "Preview deployment returns HTTP 503",
      initialDescription: "The payments preview deployment returns HTTP 503.",
      initialAnalysis: "Checked the deployment logs.",
      initialRecommendations: {
        environment: "Preview / Dev",
        team: "CCD",
        area: "AKS",
      },
    });

    const fallbackBlocks = client.chat.postMessage.mock.calls[2][0].blocks;
    expect(fallbackBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          block_id: "help_request_conversation_review_summary",
          accessory: expect.objectContaining({
            action_id: "help_request_conversation_edit_summary",
          }),
        }),
        expect.objectContaining({ type: "actions" }),
      ]),
    );
  });

  it("skips environment, team and area when AI suggestions are available", async () => {
    const start = {
      ts: "1",
      bot_id: "B1",
      text: "Drafted ticket",
      blocks: [
        { block_id: "help_request_conversation_start_other" },
        {
          block_id: "help_request_conversation_draft_summary",
          text: { text: "*Draft summary:* Preview returns 503" },
        },
        {
          block_id: "help_request_conversation_draft_description",
          text: { text: "Preview returns 503" },
        },
        { block_id: "help_request_conversation_draft_environment_dev" },
        { block_id: "help_request_conversation_draft_team_ccd" },
        { block_id: "help_request_conversation_draft_area_aks" },
      ],
    };
    const messages = [
      start,
      markedBot("2", "help_request_conversation_prompt_prBuildUrl"),
      user("3", "skip"),
      markedBot("4", "help_request_conversation_prompt_analysis"),
      user("5", "Checked the pod logs"),
    ];
    const client = { chat: { postMessage: jest.fn() } };

    await handleConversationalHelpReply({
      message: { ...messages.at(-1), channel: "D1", thread_ts: "1" },
      client,
      messages,
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({
            block_id: "help_request_conversation_prompt_confirmation",
          }),
        ]),
      }),
    );
    const reviewText = client.chat.postMessage.mock.calls[0][0].blocks
      .map((block) => block.text?.text ?? "")
      .join("\n");
    expect(reviewText).toContain("*Review your help request*");
    const reviewBlocks = client.chat.postMessage.mock.calls[0][0].blocks;
    expect(reviewBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          block_id: "help_request_conversation_review_summary",
          accessory: expect.objectContaining({
            action_id: "help_request_conversation_edit_summary",
          }),
        }),
        expect.objectContaining({
          block_id: "help_request_conversation_review_team",
          accessory: expect.objectContaining({
            action_id: "help_request_conversation_review_select_team",
            initial_option: expect.objectContaining({
              text: expect.objectContaining({ text: "CCD" }),
            }),
          }),
        }),
      ]),
    );
  });

  it("validates conversational select answers", () => {
    expect(validateAnswer("environment", "prod", "other")).toEqual({
      value: expect.objectContaining({ value: "production" }),
    });
    expect(validateAnswer("team", "not a real team", "other")).toEqual({
      error: expect.stringContaining("couldn't match"),
    });
  });

  it("remembers dropdown selections when Slack omits their metadata", () => {
    const messages = [
      markedBot("1", "help_request_conversation_start_other", {
        event_payload: {
          area: "other",
          initial_summary: "Preview unavailable",
          initial_description: "Preview returns 503",
        },
      }),
      markedBot("2", "help_request_conversation_prompt_environment"),
      {
        ts: "3",
        bot_id: "B1",
        text: "Selected: Production",
        blocks: [
          {
            type: "context",
            block_id: "help_request_conversation_answer_environment",
            elements: [{ type: "mrkdwn", text: "*Selected:* Production" }],
          },
        ],
      },
      markedBot("4", "help_request_conversation_prompt_team"),
    ];
    const session = findActiveSession(messages);

    expect(buildState(messages, session)).toEqual(
      expect.objectContaining({
        environment: expect.objectContaining({ value: "production" }),
      }),
    );
  });

  it("starts a text edit inside the thread from a review button", async () => {
    const start = markedBot("1", "help_request_conversation_start_other", {
      event_payload: {
        area: "other",
        initial_summary: "Preview unavailable",
        initial_description: "Preview returns 503",
      },
    });
    const review = {
      ...markedBot("2", "help_request_conversation_prompt_confirmation"),
      thread_ts: "1",
      blocks: [
        {
          type: "section",
          block_id: "help_request_conversation_prompt_confirmation",
        },
        {
          type: "section",
          block_id: "help_request_conversation_review_summary",
          accessory: {
            type: "button",
            action_id: "help_request_conversation_edit_summary",
          },
        },
        { type: "actions", elements: [] },
      ],
    };
    const client = {
      conversations: {
        replies: jest.fn().mockResolvedValue({ messages: [start, review] }),
      },
      chat: { update: jest.fn(), postMessage: jest.fn() },
    };

    await handleConversationalHelpAction({
      client,
      body: {
        channel: { id: "D1" },
        user: { id: "U1" },
        message: review,
      },
      action: { action_id: "help_request_conversation_edit_summary" },
    });

    expect(client.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "D1",
        ts: "2",
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: "input",
            block_id: "help_request_conversation_inline_summary",
            element: expect.objectContaining({
              type: "plain_text_input",
              initial_value: "Preview unavailable",
            }),
          }),
          expect.objectContaining({
            block_id: "help_request_conversation_inline_actions_summary",
          }),
        ]),
      }),
    );
    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });

  it("saves an inline text edit and refreshes the review in the thread", async () => {
    const start = markedBot("1", "help_request_conversation_start_other", {
      event_payload: {
        area: "other",
        initial_summary: "Old summary",
        initial_description: "Preview returns 503",
        initial_analysis: "Checked logs",
        initial_environment: "dev",
        initial_team: "ccd",
        initial_area: "aks",
      },
    });
    const review = {
      ...markedBot("2", "help_request_conversation_prompt_confirmation"),
      thread_ts: "1",
      blocks: [
        {
          type: "section",
          block_id: "help_request_conversation_prompt_confirmation",
        },
        {
          type: "input",
          block_id: "help_request_conversation_inline_summary",
          element: {
            type: "plain_text_input",
            action_id: "help_request_conversation_inline_value_summary",
          },
        },
        {
          type: "actions",
          block_id: "help_request_conversation_inline_actions_summary",
          elements: [],
        },
      ],
    };
    const client = {
      conversations: {
        replies: jest.fn().mockResolvedValue({ messages: [start, review] }),
      },
      chat: { update: jest.fn(), postMessage: jest.fn() },
    };

    await handleConversationalHelpAction({
      client,
      body: {
        channel: { id: "D1" },
        user: { id: "U1" },
        message: review,
        state: {
          values: {
            help_request_conversation_inline_summary: {
              help_request_conversation_inline_value_summary: {
                type: "plain_text_input",
                value: "New concise summary",
              },
            },
          },
        },
      },
      action: { action_id: "help_request_conversation_inline_save_summary" },
    });

    expect(client.chat.postMessage).not.toHaveBeenCalled();
    const refreshedReview = client.chat.update.mock.calls[0][0];
    expect(
      refreshedReview.blocks.find(
        (block) =>
          block.block_id === "help_request_conversation_review_summary",
      ).text.text,
    ).toContain("New concise summary");
  });

  it("updates a review dropdown immediately inside the thread", async () => {
    const start = markedBot("1", "help_request_conversation_start_other", {
      event_payload: {
        area: "other",
        initial_summary: "Preview unavailable",
        initial_description: "Preview returns 503",
        initial_analysis: "Checked logs",
        initial_environment: "dev",
        initial_team: "adoption",
        initial_area: "aks",
      },
    });
    const review = {
      ...markedBot("2", "help_request_conversation_prompt_confirmation"),
      thread_ts: "1",
      blocks: [
        {
          type: "section",
          block_id: "help_request_conversation_prompt_confirmation",
        },
        {
          type: "section",
          block_id: "help_request_conversation_review_team",
          accessory: {
            type: "static_select",
            action_id: "help_request_conversation_review_select_team",
          },
        },
        { type: "actions", elements: [] },
      ],
    };
    const client = {
      conversations: {
        replies: jest.fn().mockResolvedValue({ messages: [start, review] }),
      },
      chat: { update: jest.fn(), postMessage: jest.fn() },
    };

    await handleConversationalHelpAction({
      client,
      body: {
        channel: { id: "D1" },
        user: { id: "U1" },
        message: review,
      },
      action: {
        action_id: "help_request_conversation_review_select_team",
        selected_option: {
          text: { type: "plain_text", text: "CCD" },
          value: "ccd",
        },
      },
    });

    expect(client.chat.postMessage).not.toHaveBeenCalled();
    const refreshedReview = client.chat.update.mock.calls[0][0];
    expect(refreshedReview.ts).toBe("2");
    const classification = refreshedReview.blocks.find(
      (block) => block.block_id === "help_request_conversation_review_team",
    );
    expect(classification.accessory.initial_option.text.text).toBe("CCD");
  });

  it("submits the collected answers after confirmation", async () => {
    const messages = [
      markedBot("1", "help_request_conversation_start_other", {
        event_payload: { area: "other" },
      }),
      markedBot("2", "help_request_conversation_prompt_summary"),
      user("3", "Preview is unavailable"),
      markedBot("4", "help_request_conversation_prompt_description"),
      user("5", "The preview namespace returns a 503"),
      markedBot("6", "help_request_conversation_prompt_prBuildUrl"),
      user("7", "skip"),
      markedBot("8", "help_request_conversation_prompt_analysis"),
      user("9", "Restarted the pod"),
      markedBot("10", "help_request_conversation_prompt_environment"),
      user("11", "Preview / Dev"),
      markedBot("12", "help_request_conversation_prompt_team"),
      user("13", "CCD"),
      markedBot("14", "help_request_conversation_prompt_area"),
      user("15", "AKS"),
      markedBot("16", "help_request_conversation_prompt_confirmation"),
      user("17", "yes"),
    ];
    const client = {
      assistant: { threads: { setStatus: jest.fn() } },
      chat: { postMessage: jest.fn() },
    };

    const handled = await handleConversationalHelpReply({
      message: {
        ...messages.at(-1),
        channel: "D1",
        channel_type: "im",
        thread_ts: "1",
      },
      client,
      messages,
    });

    expect(handled).toBe(true);
    expect(submitConversationalHelpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        platformArea: "other",
        helpRequest: expect.objectContaining({
          summary: "Preview is unavailable",
          description: "The preview namespace returns a 503",
          prBuildUrl: "",
          analysis: "Restarted the pod",
          environment: expect.objectContaining({ value: "dev" }),
          team: expect.objectContaining({ value: "ccd" }),
          area: expect.objectContaining({ value: "aks" }),
        }),
      }),
    );
  });

  it("ends an active interview when the user says cancel", async () => {
    const messages = [
      markedBot("1", "help_request_conversation_start_crime", {
        event_payload: { area: "crime" },
      }),
      markedBot("2", "help_request_conversation_prompt_summary"),
      user("3", "cancel"),
    ];
    const client = { chat: { postMessage: jest.fn() } };

    await handleConversationalHelpReply({
      message: { ...messages.at(-1), channel: "D1", thread_ts: "1" },
      client,
      messages,
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            block_id: "help_request_conversation_cancelled",
          }),
        ],
      }),
    );
  });

  it("advances a dropdown selection without printing the option list", async () => {
    const environmentPrompt = {
      ...markedBot("10", "help_request_conversation_prompt_environment"),
      text: "Which environment is affected? Choose or type the name.",
      blocks: [
        {
          type: "section",
          block_id: "help_request_conversation_prompt_environment",
          text: { type: "mrkdwn", text: "Which environment is affected?" },
          accessory: {
            type: "static_select",
            action_id: "help_request_conversation_select_environment",
          },
        },
      ],
    };
    const messages = [
      markedBot("1", "help_request_conversation_start_other", {
        event_payload: {
          area: "other",
          initial_description: "Preview returns a 503",
        },
      }),
      markedBot("2", "help_request_conversation_prompt_summary"),
      user("3", "Preview unavailable"),
      markedBot("4", "help_request_conversation_prompt_prBuildUrl"),
      user("5", "skip"),
      markedBot("6", "help_request_conversation_prompt_analysis"),
      user("7", "skip"),
      environmentPrompt,
    ];
    const client = {
      conversations: {
        replies: jest.fn().mockResolvedValue({ messages }),
      },
      chat: {
        update: jest.fn(),
        postMessage: jest.fn().mockResolvedValue({}),
      },
    };

    await handleConversationalHelpAction({
      client,
      body: {
        channel: { id: "D1" },
        user: { id: "U1" },
        message: {
          ...environmentPrompt,
          thread_ts: "1",
        },
      },
      action: {
        action_id: "help_request_conversation_select_environment",
        selected_option: {
          text: { type: "plain_text", text: "Production" },
          value: "production",
        },
      },
    });

    expect(client.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [expect.not.objectContaining({ accessory: expect.anything() })],
      }),
    );
    expect(client.chat.postMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: "Selected: Production",
        metadata: expect.objectContaining({
          event_payload: {
            step: "environment",
            answer: "Production",
          },
        }),
      }),
    );
    expect(client.chat.postMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            block_id: "help_request_conversation_prompt_team",
            accessory: expect.objectContaining({ type: "static_select" }),
          }),
        ],
      }),
    );
    expect(client.chat.postMessage.mock.calls[1][0].text).not.toContain(
      "Access Management",
    );
  });

  it("advances from the clicked dropdown when thread history is stale", async () => {
    const environmentPrompt = {
      ...markedBot("10", "help_request_conversation_prompt_environment"),
      text: "Which environment is affected? Choose or type the name.",
      blocks: [
        {
          type: "section",
          block_id: "help_request_conversation_prompt_environment",
          text: { type: "mrkdwn", text: "Which environment is affected?" },
          accessory: {
            type: "static_select",
            action_id: "help_request_conversation_select_environment",
          },
        },
      ],
    };
    const staleHistory = [
      markedBot("1", "help_request_conversation_start_other", {
        event_payload: {
          area: "other",
          initial_summary: "Preview unavailable",
          initial_description: "Preview returns a 503",
        },
      }),
      markedBot("8", "help_request_conversation_prompt_analysis"),
      user("9", "Checked the pod logs"),
    ];
    const client = {
      conversations: {
        replies: jest.fn().mockResolvedValue({ messages: staleHistory }),
      },
      chat: {
        update: jest.fn(),
        postMessage: jest.fn().mockResolvedValue({}),
      },
    };

    const handled = await handleConversationalHelpAction({
      client,
      body: {
        channel: { id: "D1" },
        user: { id: "U1" },
        message: { ...environmentPrompt, thread_ts: "1" },
      },
      action: {
        action_id: "help_request_conversation_select_environment",
        selected_option: {
          text: { type: "plain_text", text: "Production" },
          value: "production",
        },
      },
    });

    expect(handled).toBe(true);
    expect(client.conversations.replies).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 200 }),
    );
    expect(client.chat.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            block_id: "help_request_conversation_prompt_team",
          }),
        ],
      }),
    );
  });
});
