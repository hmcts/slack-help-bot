const { App, LogLevel, SocketModeReceiver } = require('@slack/bolt');

const app = new App({
    token: process.env.SLACK_BOT_TOKEN, //disable this if enabling OAuth in socketModeReceiver
    // logLevel: LogLevel.DEBUG,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
});

const reportChannel = process.env.REPORT_CHANNEL;

(async () => {
    await app.start();
    console.log('⚡️ Bolt app started');
})();

// Publish a App Home
app.event('app_home_opened', async ({ event, client }) => {
    await client.views.publish({
        user_id: event.user,
        view: {
            "type":"home",
            "blocks":[
                {
                    "type": "section",
                    "block_id": "section678",
                    "text": {
                        "type": "mrkdwn",
                        "text": "App Home Published via web sockets in glitch"
                    },
                }
            ]
        },
    });
});

function option(name, option) {
    return {
        text: {
            type: "plain_text",
            text: name,
            emoji: true
        },
        value: option ?? name.toLowerCase()
    }
}

// Message Shortcut example
app.shortcut('launch_msg_shortcut', async ({ shortcut, body, ack, context, client }) => {
    await ack();
    console.log(shortcut);
});

// Global Shortcut example
// setup global shortcut in App config with `launch_shortcut` as callback id
// add `commands` scope
app.shortcut('launch_shortcut', async ({ shortcut, body, ack, context, client }) => {
    try {
        // Acknowledge shortcut request
        await ack();

        // Call the views.open method using one of the built-in WebClients
        const result = await client.views.open({
            trigger_id: shortcut.trigger_id,
            view: {
                "title": {
                    "type": "plain_text",
                    "text": "Platform help request"
                },
                "submit": {
                    "type": "plain_text",
                    "text": "Submit"
                },
                "blocks": [
                    {
                        "type": "input",
                        "block_id": "summary",
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "title",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Short description of the issue"
                            }
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Issue summary"
                        }
                    },
                    {
                        "type": "input",
                        "block_id": "urls",
                        "optional": true,
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "title",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Link to any build or pull request"
                            }
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "PR / build URLs"
                        }
                    },
                    {
                        "type": "input",
                        "block_id": "environment",
                        "optional": true,
                        "element": {
                            "type": "static_select",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Choose an environment",
                                "emoji": true
                            },
                            "options": [
                                option('AAT / Staging', 'staging'),
                                option('Preview / Dev', 'dev'),
                                option('Production'),
                                option('Perftest / Test', 'test'),
                                option('ITHC'),
                                option('N/A', 'none')
                            ],
                            "action_id": "environment"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Environment",
                            "emoji": true
                        }
                    },
                    {
                        "type": "input",
                        "block_id": "description",
                        "element": {
                            "type": "plain_text_input",
                            "multiline": true,
                            "action_id": "description"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Issue description",
                            "emoji": true
                        }
                    },
                    {
                        "type": "input",
                        "block_id": "analysis",
                        "element": {
                            "type": "plain_text_input",
                            "multiline": true,
                            "action_id": "analysis"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Analysis done so far",
                            "emoji": true
                        }
                    },
                    {
                        "type": "input",
                        "block_id": "checked_with_team",
                        "element": {
                            "type": "static_select",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select an item",
                                "emoji": true
                            },
                            "options": [
                                option('No'),
                                option('Yes')
                            ],
                            "action_id": "checked_with_team"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Have you checked with your team?",
                            "emoji": true
                        }
                    },
                    {
                        "type": "input",
                        "block_id": "action_required",
                        "optional": true,
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "plain_text_input-action",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "If you know what needs doing let us know"
                            }
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Action required",
                            "emoji": true
                        }
                    }
                ],
                "type": "modal",
                callback_id: 'create_help_request'
            }
        });
    }
    catch (error) {
        console.error(JSON.stringify(error));
    }
});

app.view('create_help_request', async ({ ack, body, view, client }) => {
    // Acknowledge the view_submission event
    await ack();

    console.log(JSON.stringify(view.state.values))
    const user = body.user.id;
    console.log(user)

    // Message the user
    try {
        const summary = view.state.values.summary.title.value
        const environment = view.state.values.environment.environment.selected_option?.text.text || "None"
        const jiraId = "DTSPO-1111"

        const result = await client.chat.postMessage({
            channel: reportChannel,
            text: 'New platform help request raised',
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `New platform help request raised by <@${user}>`
                    }
                },
                {
                    "type": "divider"
                },
                {
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": `:warning: Summary: ${summary}.`,
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": `:house: Environment: ${environment}.`,
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": ":mechanic: Assigned to: "
                    },
                    "accessory": {
                        "type": "users_select",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Unassigned",
                            "emoji": true
                        },
                        "action_id": "users_select-action"
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": `View on Jira: <https://tools.hmcts.net/jira/browse/${jiraId}|${jiraId}>`
                        }
                    ]
                },
                {
                    "type": "divider"
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": ":eyes: Take it",
                                "emoji": true
                            },
                            "value": "assign_help_request_to_me",
                            "action_id": "assign_help_request_to_me"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": " :white_check_mark: Resolve",
                                "emoji": true
                            },
                            "value": "resolve_help_request",
                            "action_id": "resolve_help_request"
                        }
                    ]
                },
                {
                    "type": "divider"
                }
            ]
        });
    } catch (error) {
        console.error(error);
    }

});


// subscribe to 'app_mention' event in your App config
// need app_mentions:read and chat:write scopes
app.event('app_mention', async ({ event, context, client, say }) => {
    try {
        await say({"blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Thanks for the mention <@${event.user}>! Click my fancy button`
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Button",
                            "emoji": true
                        },
                        "value": "click_me_123",
                        "action_id": "first_button"
                    }
                }
            ]});
    }
    catch (error) {
        console.error(error);
    }
});

// subscribe to `message.channels` event in your App Config
// need channels:read scope
app.message('hello', async ({ message, say }) => {
    // say() sends a message to the channel where the event was triggered
    // no need to directly use 'chat.postMessage', no need to include token
    await say({"blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Thanks for the mention <@${message.user}>! Click my fancy button`
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Button",
                        "emoji": true
                    },
                    "value": "click_me_123",
                    "action_id": "first_button"
                }
            }
        ]});
});

// Listen and respond to button click
app.action('first_button', async({action, ack, say, context}) => {
    console.log('button clicked');
    console.log(action);
    // acknowledge the request right away
    await ack();
    await say('Thanks for clicking the fancy button');
});

// Listen to slash command
// need to add commands permission
// create slash command in App Config
app.command('/socketslash', async ({ command, ack, say }) => {
    // Acknowledge command request
    await ack();

    await say(`${command.text}`);
});
