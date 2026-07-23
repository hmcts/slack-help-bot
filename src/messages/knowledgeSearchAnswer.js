const { stringTrim } = require("./util");

function knowledgeSearchAnswerBlocks({ answer, area }) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: stringTrim(answer, 2900, "..."),
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Raise help request",
            emoji: true,
          },
          action_id:
            area === "crime"
              ? "begin_help_request_crime"
              : "begin_help_request_non_crime",
        },
      ],
    },
  ];
}

module.exports.knowledgeSearchAnswerBlocks = knowledgeSearchAnswerBlocks;
