const {
  environments,
  lookupEnvironment,
  lookupTeam,
  teams,
  areas,
  lookupArea,
} = require("./helpFormData");

function helpFormAnalyticsBlocks({
  user,
  helpRequest,
  isAdvanced,
  errorMessage,
}) {
  return [
    {
      type: "divider",
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "*Additional information*\nThese may have been pre-filled, please check for accuracy and change if needed:",
        },
      ],
    },

    {
      type: "input",
      element: {
        type: "static_select",
        placeholder: {
          type: "plain_text",
          text: "Select an item",
          emoji: true,
        },
        options: environments,
        action_id: "environment",
        // Arcane javascript alchemy to only provide initial_option if we have a value for it
        ...(helpRequest?.environment && helpRequest.environment.text
          ? {
              initial_option: helpRequest.environment,
            }
          : { initial_option: lookupEnvironment(helpRequest.environment) }),
      },
      label: {
        type: "plain_text",
        text: "Environment :house_with_garden:",
        emoji: true,
      },
    },
    {
      type: "input",
      element: {
        type: "static_select",
        placeholder: {
          type: "plain_text",
          text: "Select an item",
          emoji: true,
        },
        options: teams,
        action_id: "team",
        ...(helpRequest?.team && helpRequest.team.text
          ? {
              initial_option: helpRequest.team,
            }
          : { initial_option: lookupTeam(helpRequest.team) }),
      },
      label: {
        type: "plain_text",
        text: "Team :busts_in_silhouette:",
        emoji: true,
      },
    },
    {
      type: "input",
      element: {
        type: "static_select",
        placeholder: {
          type: "plain_text",
          text: "Select an item",
          emoji: true,
        },
        options: areas,
        action_id: "area",
        ...(helpRequest?.area && helpRequest.area.text
          ? {
              initial_option: helpRequest.area,
            }
          : { initial_option: lookupArea(helpRequest.area) }),
      },
      label: {
        type: "plain_text",
        text: "Area :globe_with_meridians:",
        emoji: true,
      },
    },
    isAdvanced
      ? {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<@${user}> submitted *Platform Help Request*`,
          },
        }
      : {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${errorMessage?.length > 0 ? ":x: " + errorMessage : " "}`,
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Create",
              emoji: true,
            },
            value: "submit_help_request",
            action_id: "submit_help_request",
          },
        },
  ];
}

function helpFormMainBlocks({ errorMessage, helpRequest, isAdvanced }) {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Platform Help Request",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Please fill out the following request:",
      },
    },
    {
      type: "input",
      element: {
        type: "plain_text_input",
        action_id: "summary",
        initial_value: helpRequest?.summary ?? "",
      },
      label: {
        type: "plain_text",
        text: "Issue Summary",
        emoji: true,
      },
    },
    {
      type: "input",
      element: {
        type: "plain_text_input",
        action_id: "build_url",
        initial_value: helpRequest?.prBuildUrl ?? "",
      },
      label: {
        type: "plain_text",
        text: "PR / Build URLs :link: (Optional)",
        emoji: true,
      },
      optional: true,
    },
    {
      type: "divider",
    },
    {
      type: "input",
      element: {
        type: "plain_text_input",
        multiline: true,
        action_id: "description",
        initial_value: helpRequest?.description ?? "",
      },
      label: {
        type: "plain_text",
        text: "Description :spiral_note_pad:",
        emoji: true,
      },
      hint: {
        type: "plain_text",
        text: "What is the problem? What have you tried so far?",
        emoji: true,
      },
    },
    {
      type: "input",
      element: {
        type: "plain_text_input",
        multiline: true,
        action_id: "analysis",
        initial_value: helpRequest?.analysis ?? "",
      },
      label: {
        type: "plain_text",
        text: "Suggested fix or additional information :thinking_face: (Optional)",
        emoji: true,
      },
      hint: {
        type: "plain_text",
        text: "If you have any links, have found something on stackoverflow or have seen something similar before.",
        emoji: true,
      },
      optional: true,
    },
    ...(isAdvanced
      ? []
      : [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${errorMessage?.length > 0 ? ":x: " + errorMessage : " "}`,
            },
            accessory: {
              type: "button",
              text: {
                type: "plain_text",
                text: "Next",
                emoji: true,
              },
              value: "submit_initial_help_request",
              action_id: "submit_initial_help_request",
            },
          },
        ]),
  ];
}

module.exports.helpFormMainBlocks = helpFormMainBlocks;
module.exports.helpFormAnalyticsBlocks = helpFormAnalyticsBlocks;
