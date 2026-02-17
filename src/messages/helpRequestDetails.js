const { stringTrim } = require("./util");

function formatFollowUpAnswers(followUpAnswers) {
  if (!Array.isArray(followUpAnswers) || followUpAnswers.length === 0) {
    return null;
  }

  const lines = followUpAnswers
    .filter((item) => item && item.question && item.answer)
    .map((item) => `*${item.question}*\n${item.answer}`)
    .join("\n\n");

  return lines.length > 0 ? lines : null;
}

function helpRequestDetailBlocks({ description, analysis, followUpAnswers }) {
  const followUpText = formatFollowUpAnswers(followUpAnswers);
  const blocks = [
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

  if (followUpText) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: stringTrim(
          `:speech_balloon: *Follow-up answers*\n${followUpText}`,
          3000,
          "... [Truncated] see Jira for rest of message.",
        ),
      },
    });
  }

  return blocks;
}

module.exports.helpRequestDetailBlocks = helpRequestDetailBlocks;
