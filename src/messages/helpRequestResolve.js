const { optionBlock } = require("./util");

function helpRequestResolveBlocks({ thread_ts, area }) {
  function getResolutionCategories() {
    if (area === "other") {
      return [
        optionBlock("Missing / Inadequate Docs"),
        optionBlock("Self-Service Gap"),
        optionBlock("Tooling / Automation Deficiency"),
        optionBlock("Platform Feature Missing / Misaligned"),
        optionBlock("Poor Signposting / Discoverability"),
        optionBlock("User Education / Misuse"),
        optionBlock("Policy / Process Ambiguity"),
        optionBlock("Incident / One-Off Platform Failure"),
        optionBlock("External Failure (GitHub / Azure / Sonarcloud etc)"),
        optionBlock("Triage Error / Wrong Queue"),
        optionBlock("Network Failure"),
      ];
    } else if (area === "crime") {
      return [
        optionBlock("Missing / Inadequate Docs"),
        optionBlock("Self-Service Gap"),
        optionBlock("Tooling / Automation Deficiency"),
        optionBlock("Platform Feature Missing / Misaligned"),
        optionBlock("Poor Signposting / Discoverability"),
        optionBlock("User Education / Misuse"),
        optionBlock("Policy / Process Ambiguity"),
        optionBlock("Incident / One-Off Platform Failure"),
        optionBlock("External Failure (GitHub / Azure / Sonarcloud etc)"),
        optionBlock("Triage Error / Wrong Queue"),
        optionBlock("Network Failure"),
        optionBlock("Joiner / Mover / Leaver (JML)", "jml"),
        optionBlock("Release Support"),
      ];
    }
  }

  const resolutionCategories = getResolutionCategories();

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
        type: "section",
        block_id: "doc_block",
        text: {
          type: "plain_text",
          text: "Please reference ops-runbook for explanation details on the resolution categories:",
          emoji: true,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "<https://hmcts.github.io/ops-runbooks/BAU-Live-Services/platops-help-request.html#resolve-a-platops-bau-ticket>",
          },
        ],
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
          options: resolutionCategories,
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
    callback_id: `document_help_request${area === "crime" ? "_crime" : ""}`,
    // We use the private_metadata field to smuggle the ts of the thread
    // into the form so the bot knows where to reply when the form is submitted
    private_metadata: `${thread_ts}`,
  };
}

module.exports.helpRequestResolveBlocks = helpRequestResolveBlocks;
