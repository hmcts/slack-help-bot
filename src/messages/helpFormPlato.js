const config = require("config");

function helpFormPlatoBlocks({ user, isAdvanced }) {
    return [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `Did you know that we have now launched a Virtual Assistant <@${config.get(
                    "slack.plato_user_id",
                )}> who can help with your queries? You can just say help  or ask your question directly in the DM to the Plato Bot.`,
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `<${config.get(
                    "slack.plato_link",
                )}|Chat with Plato>  :rpe:`,
            },
        },
        isAdvanced
            ? {
                  type: "section",
                  text: {
                      type: "mrkdwn",
                      text: `<@${user}> clicked *Plato Couldn't Help Me :(*`,
                  },
              }
            : {
                  type: "actions",
                  elements: [
                      {
                          type: "button",
                          text: {
                              type: "plain_text",
                              text: "Plato Couldn't Help Me :(",
                              emoji: true,
                          },
                          action_id: "start_help_form",
                      },
                  ],
              },
    ];
}

module.exports.helpFormPlatoBlocks = helpFormPlatoBlocks;
