function knowledgeSearchPromptBlocks(
  promptText = "Which platform do you need support with?",
) {
  return [
    {
      type: "section",
      block_id: "knowledge_search_conversation_platform_prompt",
      text: {
        type: "mrkdwn",
        text: promptText,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Crime / CPP" },
          action_id: "knowledge_search_conversation_platform_crime",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Cloud Native / Other" },
          action_id: "knowledge_search_conversation_platform_other",
        },
      ],
    },
  ];
}

module.exports.knowledgeSearchPromptBlocks = knowledgeSearchPromptBlocks;
