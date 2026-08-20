const { convertJiraKeyToUrl } = require("./util");

function helpRequestMainBlocks({
  user,
  summary,
  environment,
  prBuildUrl,
  jiraId,
  priority,
  area,
}) {
  const mainFields = [
    {
      type: "mrkdwn",
      text: "*Status* :fire:  \n Open",
    },
    {
      type: "mrkdwn",
      text: `*Reporter* :man-surfing: \n <@${user}>`,
    },
    {
      type: "mrkdwn",
      text: `*Environment* :house_with_garden: \n ${environment.text.text}`,
    },
    {
      type: "mrkdwn",
      text: `*Priority* :rotating_light: \n ${priority?.text?.text || "Normal"}`,
    },
  ];

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${summary}*`,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      fields: mainFields,
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*PR / build URLs* :link: \n${prBuildUrl ?? "None"}`,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `View on Jira: <${convertJiraKeyToUrl(jiraId)}|${jiraId}>`,
        },
      ],
    },
    {
      type: "divider",
    },
    {
      type: "actions",
      block_id: "actions",
      elements: [
        {
          type: "users_select",
          placeholder: {
            type: "plain_text",
            text: "Unassigned",
            emoji: true,
          },
          action_id: "assign_help_request_to_user",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: ":raising_hand: Take it",
            emoji: true,
          },
          style: "primary",
          value: "assign_help_request_to_me",
          action_id: "assign_help_request_to_me",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: ":female-firefighter: Start",
            emoji: true,
          },
          style: "primary",
          value: "start_help_request",
          action_id: `start_help_request${area === "crime" ? "_crime" : ""}`,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: ":eyes: Watching: 0",
            emoji: true,
          },
          action_id: "manage_help_request_thread_watch",
          value: "[]",
        },
        {
          type: "static_select",
          placeholder: {
            type: "plain_text",
            text: "Change priority",
            emoji: true,
          },
          options: [
            {
              text: { type: "plain_text", text: "Normal", emoji: true },
              value: "normal",
            },
            {
              text: { type: "plain_text", text: "High", emoji: true },
              value: "high",
            },
            {
              text: { type: "plain_text", text: "Critical", emoji: true },
              value: "critical",
            },
          ],
          action_id: "change_help_request_priority",
        },
      ],
    },
    {
      type: "divider",
    },
  ];
}

module.exports.helpRequestMainBlocks = helpRequestMainBlocks;
