jest.mock("../service/conversationKnowledge", () => ({
  answerConversation: jest.fn(),
}));

jest.mock("../service/conversationIntent", () => ({
  classifyConversationIntent: jest.fn().mockResolvedValue("work_question"),
}));

jest.mock("./conversationalHelpRequest", () => ({
  handleConversationalHelpReply: jest.fn().mockResolvedValue(false),
  startConversationalHelpRequest: jest.fn(),
}));

jest.mock("./conversationEscalation", () => ({
  continueAfterDocumentation: jest.fn(),
  handleClarificationReply: jest.fn().mockResolvedValue(false),
  handleDocumentationFeedback: jest.fn().mockResolvedValue(false),
  handleJiraFeedback: jest.fn().mockResolvedValue(false),
}));

const { answerConversation } = require("../service/conversationKnowledge");
const { classifyConversationIntent } = require("../service/conversationIntent");
const { continueAfterDocumentation } = require("./conversationEscalation");
const {
  conversationFromHistory,
  extractAreaFromHistory,
  handleConversationMessage,
  handleAgentMessage,
  handleAgentConversationAction,
  pendingPlatformSelection,
  parsePlatformArea,
  recentMessages,
  isClosedConversation,
} = require("./assistant");

describe("Slack assistant", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("greets without searching when the user only says hello", async () => {
    classifyConversationIntent.mockResolvedValueOnce("greeting");
    const say = jest.fn();
    const client = {
      conversations: {
        replies: jest.fn().mockResolvedValue({
          messages: [{ ts: "100.000", user: "U1", text: "hi" }],
        }),
      },
    };

    await handleConversationMessage({
      message: {
        channel: "D1",
        thread_ts: "100.000",
        ts: "100.000",
        text: "hi",
      },
      client,
      say,
      setStatus: jest.fn(),
      setTitle: jest.fn(),
    });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          "I’m here to help with HMCTS Platform Operations",
        ),
      }),
    );
    expect(answerConversation).not.toHaveBeenCalled();
  });

  it("asks for a platform on the first question", async () => {
    const say = jest.fn();
    const client = {
      conversations: {
        replies: jest.fn().mockResolvedValue({
          messages: [{ ts: "100.000", user: "U1", text: "How do I deploy?" }],
        }),
      },
    };

    await handleConversationMessage({
      message: {
        channel: "D1",
        thread_ts: "100.000",
        ts: "100.000",
        text: "How do I deploy?",
      },
      client,
      say,
      setStatus: jest.fn(),
      setTitle: jest.fn(),
    });

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Which platform do you need support with?",
      }),
    );
    expect(answerConversation).not.toHaveBeenCalled();
  });

  it("turns a root agent-view DM into a titled thread", async () => {
    const client = {
      assistant: {
        threads: {
          setStatus: jest.fn(),
          setTitle: jest.fn(),
        },
      },
      chat: { postMessage: jest.fn() },
      conversations: {
        replies: jest.fn().mockResolvedValue({
          messages: [{ ts: "100.000", user: "U1", text: "How do I deploy?" }],
        }),
      },
    };

    await handleAgentMessage({
      message: {
        channel: "D1",
        channel_type: "im",
        ts: "100.000",
        text: "How do I deploy?",
      },
      client,
    });

    expect(client.conversations.replies).toHaveBeenCalledWith({
      channel: "D1",
      ts: "100.000",
      limit: 50,
      include_all_metadata: true,
    });
    expect(client.assistant.threads.setTitle).toHaveBeenCalledWith({
      channel_id: "D1",
      thread_ts: "100.000",
      title: "How do I deploy?",
    });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "D1",
        thread_ts: "100.000",
        text: "Which platform do you need support with?",
      }),
    );
  });

  it("handles a platform button as a conversational reply", async () => {
    answerConversation.mockResolvedValue({
      text: "Check the deployment logs.",
      resultCount: 1,
      requiresReadConfirmation: true,
    });
    const promptMessage = {
      ts: "101.000",
      thread_ts: "100.000",
      bot_id: "B1",
      text: "Which platform do you need support with?",
      blocks: [
        {
          type: "section",
          block_id: "knowledge_search_conversation_platform_prompt",
        },
        { type: "actions", elements: [] },
      ],
    };
    const client = {
      assistant: {
        threads: { setStatus: jest.fn(), setTitle: jest.fn() },
      },
      chat: { update: jest.fn(), postMessage: jest.fn() },
      conversations: {
        replies: jest.fn().mockResolvedValue({
          messages: [
            {
              ts: "100.000",
              user: "U1",
              text: "How do I inspect a failed deployment?",
            },
            promptMessage,
          ],
        }),
      },
    };

    await handleAgentConversationAction({
      client,
      body: {
        channel: { id: "D1" },
        user: { id: "U1" },
        message: promptMessage,
      },
      action: {
        action_id: "knowledge_search_conversation_platform_other",
      },
    });

    expect(answerConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "How do I inspect a failed deployment?",
        area: "other",
      }),
    );
    expect(client.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [expect.objectContaining({ type: "section" })],
      }),
    );
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Check the deployment logs." }),
    );
  });

  it("answers a follow-up using recent thread history and the saved area", async () => {
    const nowSeconds = Date.now() / 1000;
    const messages = [
      {
        ts: String(nowSeconds - 120),
        user: "U1",
        text: "How do I create a preview environment?",
      },
      {
        ts: String(nowSeconds - 90),
        bot_id: "B1",
        text: "Use the preview pipeline.",
        blocks: [
          {
            type: "section",
            block_id: "knowledge_search_context_other",
            text: { type: "mrkdwn", text: "Use the preview pipeline." },
          },
        ],
      },
      {
        ts: String(nowSeconds),
        user: "U1",
        text: "Where do I find it?",
      },
    ];
    const say = jest.fn();
    const client = {
      conversations: {
        replies: jest.fn().mockResolvedValue({ messages }),
      },
    };
    answerConversation.mockResolvedValue({
      text: "Open the pipeline page.",
      resultCount: 1,
      requiresReadConfirmation: true,
    });

    await handleConversationMessage({
      message: {
        channel: "D1",
        thread_ts: messages[0].ts,
        ts: messages[2].ts,
        text: messages[2].text,
      },
      client,
      say,
      setStatus: jest.fn(),
      setTitle: jest.fn(),
    });

    expect(answerConversation).toHaveBeenCalledWith({
      question: "Where do I find it?",
      area: "other",
      conversation: [
        { role: "user", content: "How do I create a preview environment?" },
        { role: "assistant", content: "Use the preview pipeline." },
      ],
    });
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Open the pipeline page." }),
    );
  });

  it("moves straight to JIRA when documentation has no results", async () => {
    const messages = [
      { ts: "100.000", user: "U1", text: "Why is preview failing?" },
      {
        ts: "101.000",
        bot_id: "B1",
        blocks: [{ block_id: "knowledge_search_conversation_platform_prompt" }],
      },
      { ts: "102.000", user: "U1", text: "Cloud Native / Other" },
    ];
    answerConversation.mockResolvedValue({
      text: "No documentation found.",
      resultCount: 0,
      requiresReadConfirmation: false,
    });
    const say = jest.fn();
    const client = {
      conversations: {
        replies: jest.fn().mockResolvedValue({ messages }),
      },
    };

    await handleConversationMessage({
      message: {
        ...messages.at(-1),
        channel: "D1",
        thread_ts: "100.000",
      },
      client,
      say,
      setStatus: jest.fn(),
      setTitle: jest.fn(),
    });

    expect(continueAfterDocumentation).toHaveBeenCalledWith({
      client,
      channelId: "D1",
      threadTs: "100.000",
      question: "Why is preview failing?",
      area: "other",
      docsHadResults: false,
    });
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("check similar JIRA tickets"),
      }),
    );
  });

  it("ignores replies after a conversation has been closed", async () => {
    const messages = [
      { ts: "100.000", user: "U1", text: "Preview is broken" },
      {
        ts: "101.000",
        bot_id: "B1",
        blocks: [{ block_id: "help_request_conversation_complete" }],
      },
      {
        ts: "102.000",
        user: "U1",
        text: "Can I add something else?",
      },
    ];
    const say = jest.fn();
    const client = {
      conversations: {
        replies: jest.fn().mockResolvedValue({ messages }),
      },
    };

    await handleConversationMessage({
      message: {
        ...messages.at(-1),
        channel: "D1",
        thread_ts: "100.000",
      },
      client,
      say,
      setStatus: jest.fn(),
      setTitle: jest.fn(),
    });

    expect(isClosedConversation(messages)).toBe(true);
    expect(answerConversation).not.toHaveBeenCalled();
    expect(say).not.toHaveBeenCalled();
  });
});

describe("assistant history helpers", () => {
  it("does not reuse a platform prompt after a knowledge answer", () => {
    const messages = [
      { ts: "1", user: "U1", text: "Why is preview failing?" },
      {
        ts: "2",
        bot_id: "B1",
        blocks: [{ block_id: "knowledge_search_conversation_platform_prompt" }],
      },
      { ts: "3", user: "U1", text: "Cloud Native / Other" },
      {
        ts: "4",
        bot_id: "B1",
        blocks: [{ block_id: "knowledge_search_context_other" }],
      },
      { ts: "5", user: "U1", text: "no" },
    ];

    expect(pendingPlatformSelection(messages, "5")).toBeNull();
  });

  it("understands conversational platform names", () => {
    expect(parsePlatformArea("Crime / CPP")).toBe("crime");
    expect(parsePlatformArea("Cloud Native / Other")).toBe("other");
    expect(parsePlatformArea("something else")).toBeUndefined();
  });

  it("extracts the selected area from answer blocks", () => {
    expect(
      extractAreaFromHistory([
        {
          blocks: [
            {
              block_id: "knowledge_search_context_crime",
            },
          ],
        },
      ]),
    ).toBe("crime");
  });

  it("drops the current message and messages older than 30 minutes", () => {
    const now = Date.now();
    const history = conversationFromHistory(
      [
        { ts: String((now - 31 * 60 * 1000) / 1000), text: "Old" },
        { ts: String((now - 1000) / 1000), text: "Recent" },
        { ts: "current", text: "Current" },
      ],
      "current",
      now,
    );

    expect(history).toStrictEqual([{ role: "user", content: "Recent" }]);
  });

  it("expires the selected platform with the conversation window", () => {
    const now = Date.now();
    const messages = recentMessages(
      [
        {
          ts: String((now - 31 * 60 * 1000) / 1000),
          blocks: [{ block_id: "knowledge_search_context_crime" }],
        },
        { ts: String(now / 1000), text: "A new question" },
      ],
      now,
    );

    expect(extractAreaFromHistory(messages)).toBeUndefined();
  });
});
