jest.mock("../ai/ai", () => ({
  followUpQuestions: jest.fn(),
  generateTicketSummary: jest.fn(),
  analyticsRecommendations: jest.fn(),
}));
jest.mock("../service/conversationKnowledge", () => ({
  answerConversation: jest.fn(),
}));
jest.mock("../service/searchHelpRequests", () => ({
  searchHelpRequests: jest.fn(),
}));
jest.mock("./conversationalHelpRequest", () => ({
  startConversationalHelpRequest: jest.fn(),
}));

const {
  followUpQuestions,
  generateTicketSummary,
  analyticsRecommendations,
} = require("../ai/ai");
const { answerConversation } = require("../service/conversationKnowledge");
const { searchHelpRequests } = require("../service/searchHelpRequests");
const {
  startConversationalHelpRequest,
} = require("./conversationalHelpRequest");
const {
  handleClarificationReply,
  handleDocumentationFeedback,
  handleJiraFeedback,
  searchJiraOrClarify,
  extractUserLinks,
} = require("./conversationEscalation");

function bot(ts, blockId, payload = {}) {
  return {
    ts,
    bot_id: "B1",
    text: blockId,
    blocks: [{ type: "section", block_id: blockId }],
    metadata: { event_payload: payload },
  };
}

function user(ts, text) {
  return { ts, user: "U1", text };
}

function client() {
  return {
    assistant: { threads: { setStatus: jest.fn() } },
    chat: { postMessage: jest.fn().mockResolvedValue({}) },
  };
}

describe("conversation escalation funnel", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    generateTicketSummary.mockResolvedValue(
      "Preview deployment returns HTTP 503",
    );
    analyticsRecommendations.mockResolvedValue({
      environment: "Preview / Dev",
      team: "CCD",
      area: "AKS",
    });
  });

  it("extracts and deduplicates links supplied by the user", () => {
    expect(
      extractUserLinks(
        "PR: <https://github.com/hmcts/repo/pull/42|repo#42> and logs https://example.test/build/7. Duplicate https://example.test/build/7",
      ),
    ).toBe(
      "https://github.com/hmcts/repo/pull/42\nhttps://example.test/build/7",
    );
  });

  it("searches JIRA when the documentation answer is not helpful", async () => {
    searchHelpRequests.mockResolvedValue([
      { key: "DTSPO-1", title: "Preview failed", resolution: "Retry it" },
    ]);
    const messages = [
      user("1", "Why did preview fail?"),
      bot("2", "knowledge_search_conversation_feedback_other", {
        question: "Why did preview fail?",
        area: "other",
        result_count: 2,
      }),
      user("3", "no"),
    ];
    const slack = client();

    await expect(
      handleDocumentationFeedback({
        message: { ...messages.at(-1), channel: "D1", thread_ts: "1" },
        client: slack,
        messages,
      }),
    ).resolves.toBe(true);

    expect(searchHelpRequests).toHaveBeenCalledWith(
      "Why did preview fail?",
      "other",
    );
    expect(slack.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({
            block_id: "jira_search_conversation_feedback_other",
          }),
          expect.objectContaining({ type: "actions" }),
        ]),
      }),
    );
  });

  it("repeats documentation feedback with buttons for an unrelated reply", async () => {
    const messages = [
      user("1", "Why did preview fail?"),
      bot("2", "knowledge_search_conversation_feedback_other", {
        question: "Why did preview fail?",
        area: "other",
        result_count: 2,
      }),
      user("3", "maybe later"),
    ];
    const slack = client();

    await expect(
      handleDocumentationFeedback({
        message: { ...messages.at(-1), channel: "D1", thread_ts: "1" },
        client: slack,
        messages,
      }),
    ).resolves.toBe(true);

    expect(searchHelpRequests).not.toHaveBeenCalled();
    expect(slack.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Reply `yes` or `no`"),
        blocks: expect.arrayContaining([
          expect.objectContaining({
            block_id: "knowledge_search_conversation_feedback_other",
          }),
          expect.objectContaining({ type: "actions" }),
        ]),
      }),
    );
  });

  it("starts one-at-a-time AI clarification when JIRA has no results", async () => {
    searchHelpRequests.mockResolvedValue([]);
    followUpQuestions.mockResolvedValue([
      {
        question: "What exact error message do you see?",
        placeholder: "Error text",
      },
    ]);
    const slack = client();

    await searchJiraOrClarify({
      client: slack,
      channelId: "D1",
      threadTs: "1",
      question: "Preview is broken",
      area: "other",
      docsHadResults: false,
    });

    expect(slack.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("already checked or tried"),
        blocks: [
          expect.objectContaining({
            block_id: "help_clarification_question_1",
          }),
        ],
      }),
    );
    expect(followUpQuestions).not.toHaveBeenCalled();
  });

  it("asks AI for the next question after each typed answer", async () => {
    followUpQuestions.mockResolvedValue([
      { question: "Which service is affected?", placeholder: "Service" },
    ]);
    const messages = [
      bot("2", "help_clarification_start_other", {
        question: "Preview is broken",
        area: "other",
        docs_had_results: false,
        jira_had_results: false,
      }),
      bot("3", "help_clarification_question_1", {
        question: "What have you already checked or tried?",
      }),
      user("4", "Checked the pod logs"),
    ];
    const slack = client();

    await expect(
      handleClarificationReply({
        message: { ...messages.at(-1), channel: "D1", thread_ts: "1" },
        client: slack,
        messages,
      }),
    ).resolves.toBe(true);

    expect(followUpQuestions).toHaveBeenCalledWith(
      expect.stringContaining("Checked the pod logs"),
    );
    expect(slack.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            block_id: "help_clarification_question_2",
          }),
        ],
      }),
    );
  });

  it("does not ask the investigation question again when AI rephrases it", async () => {
    followUpQuestions.mockResolvedValue([
      { question: "What have you tried so far?" },
    ]);
    const messages = [
      bot("2", "help_clarification_start_other", {
        question: "Preview is broken",
        area: "other",
        docs_had_results: false,
        jira_had_results: false,
      }),
      bot("3", "help_clarification_question_1", {
        question: "What have you already checked or tried?",
      }),
      user("4", "Checked the logs"),
    ];
    const slack = client();

    await handleClarificationReply({
      message: { ...messages.at(-1), channel: "D1", thread_ts: "1" },
      client: slack,
      messages,
    });

    expect(slack.chat.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: "What have you tried so far?" }),
    );
  });

  it("keeps the first typed answer in clarification when Slack omits metadata", async () => {
    followUpQuestions.mockResolvedValue([
      { question: "Which service is affected?", placeholder: "Service" },
    ]);
    const messages = [
      user("1", "Preview is broken"),
      {
        ts: "2",
        bot_id: "B1",
        text: "I need some further information to help you.",
        blocks: [
          { type: "section", block_id: "help_clarification_start_other" },
        ],
      },
      {
        ts: "3",
        bot_id: "B1",
        text: "What have you already checked or tried?",
        blocks: [
          { type: "section", block_id: "help_clarification_question_1" },
        ],
      },
      user("4", "Checked the deployment logs"),
    ];
    const slack = client();

    await expect(
      handleClarificationReply({
        message: { ...messages.at(-1), channel: "D1", thread_ts: "1" },
        client: slack,
        messages,
      }),
    ).resolves.toBe(true);

    expect(followUpQuestions).toHaveBeenCalledWith(
      expect.stringContaining("Checked the deployment logs"),
    );
    expect(slack.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            block_id: "help_clarification_question_2",
          }),
        ],
      }),
    );
  });

  it("stops at four questions, retries only empty sources, then starts ticket intake", async () => {
    searchHelpRequests.mockResolvedValue([
      { key: "DTSPO-2", title: "Matching issue", resolution: "Known fix" },
    ]);
    const messages = [
      user("1", "Preview is broken"),
      bot("2", "help_clarification_start_other_d1_j0"),
      bot("3", "help_clarification_question_1", {
        question: "What have you already checked or tried?",
      }),
      user("4", "Checked the pod logs; saw HTTP 503"),
      bot("5", "help_clarification_question_2", { question: "Service?" }),
      user("6", "payments"),
      bot("7", "help_clarification_question_3", { question: "Impact?" }),
      user("8", "Blocking the team; logs: https://example.test/build/7"),
      bot("9", "help_clarification_question_4", { question: "Frequency?" }),
      user("10", "Every deployment"),
    ];
    const slack = client();

    await handleClarificationReply({
      message: { ...messages.at(-1), channel: "D1", thread_ts: "1" },
      client: slack,
      messages,
    });

    expect(followUpQuestions).not.toHaveBeenCalled();
    expect(answerConversation).not.toHaveBeenCalled();
    expect(searchHelpRequests).toHaveBeenCalledWith(
      expect.stringContaining("Blocking the team"),
      "other",
    );
    expect(startConversationalHelpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        area: "other",
        initialSummary: "Preview deployment returns HTTP 503",
        initialDescription: expect.stringContaining("Service? payments"),
        initialPrBuildUrl: "https://example.test/build/7",
        initialAnalysis: "",
        initialRecommendations: {
          environment: "Preview / Dev",
          team: "CCD",
          area: "AKS",
        },
        followUpAnswers: expect.arrayContaining([
          {
            question: "Impact?",
            answer: expect.stringContaining("Blocking the team"),
          },
        ]),
      }),
    );
    expect(generateTicketSummary).toHaveBeenCalledWith(
      expect.stringContaining("Blocking the team"),
    );
    expect(analyticsRecommendations).toHaveBeenCalledWith(
      expect.stringContaining("Blocking the team"),
      "other",
    );
  });

  it("finishes when a JIRA result is useful", async () => {
    const messages = [
      bot("2", "jira_search_conversation_feedback_crime", {
        question: "Pipeline failed",
        area: "crime",
        docs_had_results: false,
      }),
      user("3", "yes"),
    ];
    const slack = client();

    await handleJiraFeedback({
      message: { ...messages.at(-1), channel: "D1", thread_ts: "1" },
      client: slack,
      messages,
    });

    expect(slack.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            block_id: "jira_search_conversation_solved",
          }),
        ],
      }),
    );
  });

  it("repeats JIRA feedback with buttons for an unrelated reply", async () => {
    const messages = [
      bot("2", "jira_search_conversation_feedback_crime", {
        question: "Pipeline failed",
        area: "crime",
      }),
      user("3", "I am not sure"),
    ];
    const slack = client();

    await expect(
      handleJiraFeedback({
        message: { ...messages.at(-1), channel: "D1", thread_ts: "1" },
        client: slack,
        messages,
      }),
    ).resolves.toBe(true);

    expect(slack.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Reply `yes` or `no`"),
        blocks: expect.arrayContaining([
          expect.objectContaining({
            block_id: "jira_search_conversation_feedback_crime",
          }),
          expect.objectContaining({ type: "actions" }),
        ]),
      }),
    );
  });
});
