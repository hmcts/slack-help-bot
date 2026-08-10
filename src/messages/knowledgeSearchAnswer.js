const { stringTrim } = require("./util");

function knowledgeSearchActionValue({
  area,
  question,
  hasReadSuggestion = false,
  requiresReadConfirmation = true,
}) {
  const value = {
    area,
    question: stringTrim(question ?? "", 1800, "..."),
  };

  if (!requiresReadConfirmation) {
    value.requiresReadConfirmation = false;
  }

  if (hasReadSuggestion) {
    value.hasReadSuggestion = true;
  }

  return JSON.stringify(value);
}

function parseKnowledgeSearchActionValue(value) {
  try {
    const parsed = JSON.parse(value);
    return {
      area: parsed.area === "crime" ? "crime" : "other",
      question: parsed.question ?? "",
      hasReadSuggestion: parsed.hasReadSuggestion === true,
      requiresReadConfirmation: parsed.requiresReadConfirmation !== false,
    };
  } catch (_) {
    return {
      area: "other",
      question: value ?? "",
      hasReadSuggestion: false,
      requiresReadConfirmation: true,
    };
  }
}

function readSuggestionCheckbox({ hasReadSuggestion }) {
  const option = {
    text: {
      type: "plain_text",
      text: "I have read the above suggestion",
      emoji: true,
    },
    value: "read_suggestion",
  };

  return {
    type: "actions",
    block_id: "knowledge_search_read_suggestion_block",
    elements: [
      {
        type: "checkboxes",
        action_id: "knowledge_search_read_suggestion",
        options: [option],
        ...(hasReadSuggestion ? { initial_options: [option] } : {}),
      },
    ],
  };
}

function knowledgeSearchAnswerBlocks({
  answer,
  area,
  question,
  state = "feedback",
  errorMessage,
  hasReadSuggestion = false,
  requiresReadConfirmation = true,
}) {
  const actionValue = knowledgeSearchActionValue({
    area,
    question,
    hasReadSuggestion,
    requiresReadConfirmation,
  });
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: stringTrim(answer, 2900, "..."),
      },
    },
    ...(state === "solved"
      ? [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: ":white_check_mark: Marked as solved.",
              },
            ],
          },
        ]
      : []),
    ...(state === "needs_help"
      ? [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: ":ticket: Help request form started. I used your original DM as the ticket description.",
              },
            ],
          },
        ]
      : []),
    ...(state === "feedback"
      ? [
          ...(errorMessage
            ? [
                {
                  type: "context",
                  elements: [
                    {
                      type: "mrkdwn",
                      text: `:warning: ${errorMessage}`,
                    },
                  ],
                },
              ]
            : []),
          ...(requiresReadConfirmation
            ? [readSuggestionCheckbox({ hasReadSuggestion })]
            : []),
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Solved",
                  emoji: true,
                },
                style: "primary",
                action_id: "knowledge_search_solved",
                value: actionValue,
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Still need help",
                  emoji: true,
                },
                action_id: "knowledge_search_still_need_help",
                value: actionValue,
              },
            ],
          },
        ]
      : []),
  ];
}

module.exports.knowledgeSearchAnswerBlocks = knowledgeSearchAnswerBlocks;
module.exports.knowledgeSearchActionValue = knowledgeSearchActionValue;
module.exports.parseKnowledgeSearchActionValue =
  parseKnowledgeSearchActionValue;
