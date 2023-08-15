const { stringTrim } = require("./util");

function helpRequestDetailBlocks({ description, analysis }) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: stringTrim(
          `:spiral_note_pad: Description: ${description}`,
          3000,
          "... [Truncated] see Jira for rest of message.",
        ),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: stringTrim(
          `:thinking_face: Analysis: ${analysis ?? "None"}`,
          3000,
          "... [Truncated] see Jira for rest of message.",
        ),
      },
    },
  ];
}

module.exports.helpRequestDetailBlocks = helpRequestDetailBlocks;
