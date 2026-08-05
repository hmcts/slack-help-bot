const { convertJiraKeyToUrl } = require("./util");

function helpRequestMainBlocks({
  user,
  summary,
  environment,
  prBuildUrl,
  jiraId,
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
      ],
    },
    {
      type: "context",
      block_id: "thread_watchers",
      elements: [
        {
          type: "mrkdwn",
          text: ":eyes: *Watching:* Nobody yet",
        },
      ],
    },
    {
      type: "actions",
      block_id: "thread_watch_actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: ":eyes: Watch thread",
            emoji: true,
          },
          action_id: "watch_help_request_thread",
          value: "watch_help_request_thread",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Stop watching",
            emoji: true,
          },
          action_id: "unwatch_help_request_thread",
          value: "unwatch_help_request_thread",
        },
      ],
    },
    {
      type: "divider",
    },
  ];
}

module.exports.helpRequestMainBlocks = helpRequestMainBlocks;
