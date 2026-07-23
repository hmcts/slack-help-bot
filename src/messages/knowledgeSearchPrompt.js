function knowledgeSearchPromptBlocks() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*In order to give you the best guidance, I need to know what area you need help in.*\n\nPlease select which Platform / area you require assistance in:\n\n• *Crime / CPP* - Crime / Common Platform - CPP\n• *Cloud Native / Other* - Cloud Native Platform (CFT, SDS) - Heritage & All Other Requests",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Crime / CPP",
            emoji: true,
          },
          action_id: "search_knowledge_store_crime",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Cloud Native / Other",
            emoji: true,
          },
          action_id: "search_knowledge_store_non_crime",
        },
      ],
    },
  ];
}

module.exports.knowledgeSearchPromptBlocks = knowledgeSearchPromptBlocks;
