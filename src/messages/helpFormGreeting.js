function helpFormGreetingBlocks({ user, area, isAdvanced }) {
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hello <@${user}> :wave:\nAre you looking for some dedicated help from Platform Operations? ${area === "other" ? "As the team is busy working to improve the platform, please be aware that it is all self-service" : ""}`,
      },
    },
    {
      type: "divider",
    },
  ];

  if (area === "crime") {
    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Before you raise a request, please make sure:*",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":white_check_mark:  You have read recent announcements on #cloud-native-announce and discussions on community channels like #cpp-devops for any recent changes done or issues being investigated.",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":white_check_mark:  Your question is not very generic as forums like #cpp-devops are best place to ask and discuss them.",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":white_check_mark:  You have asked with in your team and they suggested that it is a platform issue",
        },
      },
      {
        type: "divider",
      },
    );

    if (isAdvanced) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<@${user}> clicked *I Still Need Help*`,
        },
      });
    } else {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "I Still Need Help",
              emoji: true,
            },
            action_id: "start_help_form_crime",
          },
        ],
      });
    }
  } else if (area === "other") {
    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Before you raise a request, please make sure:*",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":white_check_mark:  You have read our <https://hmcts.github.io/|ways of working documentation> to help you in onboarding new people / teams to platform, path to live for apps and some <https://hmcts.github.io/cloud-native-platform/troubleshooting/|troubleshooting guides>.",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":white_check_mark:  You have read recent announcements on #cloud-native-announce and discussions on community channels like #cloud-native for any recent changes done or issues being investigated.",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":white_check_mark:  Your question is not very generic as forums like #cloud-native are best place to ask and discuss them.",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":white_check_mark:  You have asked with in your team and they suggested that it is a platform issue",
        },
      },
      {
        type: "divider",
      },
    );

    if (isAdvanced) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<@${user}> clicked *I Still Need Help*`,
        },
      });
    } else {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "I Still Need Help",
              emoji: true,
            },
            action_id: "show_plato_dialogue",
          },
        ],
      });
    }
  } else {
    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*In order to give you the best guidance, I need to know what area you need help in.\n\nPlease select which Platform / area you require assistance in:\n\n• *Crime / CPP* - Crime / Common Platform - CPP\n• *Cloud Native / All Other* - Cloud Native Platform (CFT, SDS) - Heritage & All Other Requests",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Crime / CPP",
              emoji: true,
            },
            action_id: "begin_help_request_crime",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Cloud Native / All Other",
              emoji: true,
            },
            action_id: "begin_help_request_non_crime",
          },
        ],
      },
    );
  }

  return blocks;
}

module.exports.helpFormGreetingBlocks = helpFormGreetingBlocks;
