const { optionBlock } = require("./util");

function helpRequestResolveBlocks({ thread_ts }) {
  return {
    title: {
      type: "plain_text",
      text: "Document Help Request",
    },
    submit: {
      type: "plain_text",
      text: "Document",
    },
    blocks: [
      {
        type: "section",
        block_id: "title_block",
        text: {
          type: "mrkdwn",
          text: "*Run into this problem often?*",
        },
      },
      {
        type: "section",
        block_id: "subtitle_block",
        text: {
          type: "plain_text",
          text: "Write some documentation to help out next time!\nKeep answers brief, but make them informative.",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "category_block",
        element: {
          type: "static_select",
          placeholder: {
            type: "plain_text",
            text: "Select an item",
            emoji: true,
          },
          options: [
            optionBlock("Application code/config issue"),
            optionBlock("External (GitHub/Azure/SonarCloud) issue"),
            optionBlock("Lack of access"),
            optionBlock("Lack of documentation"),
            optionBlock("Platform issue"),
            optionBlock("User did not do enough troubleshooting"),
            optionBlock("User error"),
            optionBlock("Working as per design"),
            optionBlock("Other"),
          ],
          action_id: "category",
        },
        label: {
          type: "plain_text",
          text: "What was the issue?",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "how_block",
        element: {
          type: "plain_text_input",
          action_id: "how",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Provide some details?",
          },
        },
        label: {
          type: "plain_text",
          text: ":bulb: How?\n (Provide some details)",
        },
        optional: true,
      },
    ],
    type: "modal",
    callback_id: "document_help_request",
    // We use the private_metadata field to smuggle the ts of the thread
    // into the form so the bot knows where to reply when the form is submitted
    private_metadata: `${thread_ts}`,
  };
}

module.exports.helpRequestResolveBlocks = helpRequestResolveBlocks;
