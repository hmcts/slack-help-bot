const {
  environments,
  lookupEnvironment,
  lookupTeam,
  teams,
  areas,
  lookupArea,
} = require("./helpFormData");
const { DateTime } = require("luxon");
const {
  convertStoragePathToHmctsWayUrl,
  extractKnowledgeStoreHighlight,
} = require("./util");

function helpFormAnalyticsBlocks({
  user,
  helpRequest,
  isAdvanced,
  errorMessage,
  area,
}) {
  return [
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
        options: environments(area),
        action_id: "environment",
        // Arcane javascript alchemy to only provide initial_option if we have a value for it
        ...(helpRequest?.environment && helpRequest.environment.text
          ? {
              initial_option: helpRequest.environment,
            }
          : {
              initial_option: lookupEnvironment(helpRequest.environment, area),
            }),
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
        options: teams(area),
        action_id: "team",
        ...(helpRequest?.team && helpRequest.team.text
          ? {
              initial_option: helpRequest.team,
            }
          : { initial_option: lookupTeam(helpRequest.team, area) }),
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
        options: areas(area),
        action_id: "area",
        ...(helpRequest?.area && helpRequest.area.text
          ? {
              initial_option: helpRequest.area,
            }
          : { initial_option: lookupArea(helpRequest.area, area) }),
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
            action_id: `submit_help_request${area === "crime" ? "_crime" : ""}`,
          },
        },
  ];
}

function mapStatus(status) {
  switch (status) {
    case "In Progress":
      return ":fire_extinguisher:";
    case "Done":
      return ":snowflake:";
    case "Open":
      return ":fire:";
    default:
      return "";
  }
}

function formatDate(date) {
  if (!date) {
    return "No created date";
  }

  return DateTime.fromISO(date.toISOString()).toLocaleString(DateTime.DATE_MED);
}

function relatedIssueBlock(issue) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${issue.title}*`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Status ${mapStatus(issue.status)} ${issue.status}`,
        },
        {
          type: "mrkdwn",
          text: `Created on ${formatDate(issue.created_at)}`,
        },
        {
          type: "mrkdwn",
          text: `<${issue.url}|${issue.key}>`,
        },
      ],
    },
    { type: "divider" },
  ];
}

function knowledgeStoreItemBlock(item) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${convertStoragePathToHmctsWayUrl(item.document.metadata_storage_path)}|${item.document.title}>*`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: extractKnowledgeStoreHighlight(item),
        },
      ],
    },
    { type: "divider" },
  ];
}

function helpFormKnowledgeStoreBlocks({
  knowledgeStoreResults,
  isAdvanced,
  area,
}) {
  if (knowledgeStoreResults.length === 0) {
    return [
      {
        type: "divider",
      },
    ];
  }

  const header = [
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Suggestions from documentation*",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "plain_text",
          text: "I've found these potentially related items in our documentation:",
          emoji: true,
        },
      ],
    },
  ];
  const knowledgeStoreBlocks = knowledgeStoreResults
    .map((item) => knowledgeStoreItemBlock(item))
    .flatMap((block) => block);

  const blocks = [...header, ...knowledgeStoreBlocks];

  if (!isAdvanced) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: " ",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Next",
          emoji: true,
        },
        action_id: `advance_from_knowledge_store${area === "crime" ? "_crime" : ""}`,
      },
    });
  }

  return blocks;
}

function helpFormRelatedIssuesBlocks({ relatedIssues, isAdvanced, area }) {
  if (relatedIssues.length === 0) {
    return [];
  }

  const header = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Related issues*",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "plain_text",
          text: "Below are issues that are potentially related, please take a look at them first:",
          emoji: true,
        },
      ],
    },
    {
      type: "divider",
    },
  ];
  const relatedIssueBlocks = relatedIssues
    .map((issue) => relatedIssueBlock(issue))
    .flatMap((block) => block);

  const blocks = [...header, ...relatedIssueBlocks];

  if (!isAdvanced) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: " ",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Next",
          emoji: true,
        },
        action_id: `advance_from_related_issues${area === "crime" ? "_crime" : ""}`,
      },
    });
  }

  return blocks;
}

function helpFormMainBlocks({ errorMessage, helpRequest, isAdvanced, area }) {
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
              action_id:
                area === "crime"
                  ? "submit_initial_help_request_crime"
                  : "submit_initial_help_request",
            },
          },
        ]),
  ];
}

module.exports.helpFormMainBlocks = helpFormMainBlocks;
module.exports.helpFormAnalyticsBlocks = helpFormAnalyticsBlocks;
module.exports.helpFormRelatedIssuesBlocks = helpFormRelatedIssuesBlocks;
module.exports.helpFormKnowledgeStoreBlocks = helpFormKnowledgeStoreBlocks;
