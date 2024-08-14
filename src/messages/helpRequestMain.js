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

  // only adding for Crime as naming is hard and I don't have a nice label for all except crime
  // and I don't think its really needed but let's try and see what feedback we get
  if (area === "crime") {
    mainFields.push({
      type: "mrkdwn",
      text: `*Area* :helicopter: \n Crime`,
    });
  }

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
          action_id: "start_help_request",
        },
      ],
    },
    {
      type: "divider",
    },
  ];
}

module.exports.helpRequestMainBlocks = helpRequestMainBlocks;
