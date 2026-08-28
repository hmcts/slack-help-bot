const { stringTrim } = require("./util");

function knowledgeSearchAnswerBlocks({ answer, area }) {
  return [
    {
      type: "section",
      block_id: `knowledge_search_context_${area}`,
      expand: true,
      text: {
        type: "mrkdwn",
        text: stringTrim(answer, 2900, "..."),
      },
    },
    {
      // Use a section block here: Slack's Agent message validation rejects
      // context elements even though they are valid in ordinary messages.
      type: "section",
      block_id: `knowledge_search_conversation_feedback_${area}`,
      text: {
        type: "mrkdwn",
        text: "Did that solve the problem? Reply `yes` or `no`, or use a button.",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Yes, solved" },
          style: "primary",
          action_id: "knowledge_search_conversation_solved",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "No, I still need help" },
          action_id: "knowledge_search_conversation_needs_help",
        },
      ],
    },
  ];
}

module.exports.knowledgeSearchAnswerBlocks = knowledgeSearchAnswerBlocks;
