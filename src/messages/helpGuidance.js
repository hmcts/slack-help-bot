const helpGuidanceText =
  "To get started, send me your question in this DM with the full issue description. Include what you tried, any errors, and useful links such as builds, PRs or logs. I will search the docs first, then help you raise a request if you still need support.";

function helpGuidanceBlocks() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: helpGuidanceText,
      },
    },
  ];
}

module.exports.helpGuidanceText = helpGuidanceText;
module.exports.helpGuidanceBlocks = helpGuidanceBlocks;
