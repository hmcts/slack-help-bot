const {helpRequestRaised, helloToBotHandler, openHelpRequestBlocks} = require("./src/messages");
const {App, LogLevel, SocketModeReceiver} = require('@slack/bolt');
const crypto = require('crypto')

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
app.event('app_home_opened', async ({event, client}) => {
    await client.views.publish({
        user_id: event.user,
        view: {
            "type": "home",
            "blocks": [
                {
                    "type": "section",
                    "block_id": "section678",
                    "text": {
                        "type": "mrkdwn",
                        "text": "App Home Published via web sockets"
                    },
                }
            ]
        },
    });
});

// Message Shortcut example
app.shortcut('launch_msg_shortcut', async ({shortcut, body, ack, context, client}) => {
    await ack();
    console.log(shortcut);
});

// Global Shortcut example
// setup global shortcut in App config with `launch_shortcut` as callback id
// add `commands` scope
app.shortcut('launch_shortcut', async ({shortcut, body, ack, context, client}) => {
    try {
        // Acknowledge shortcut request
        await ack();

        // Call the views.open method using one of the built-in WebClients
        const result = await client.views.open({
            trigger_id: shortcut.trigger_id,
            view: openHelpRequestBlocks()
        });
    } catch (error) {
        console.error(JSON.stringify(error));
    }
});

app.view('create_help_request', async ({ack, body, view, client}) => {
    // Acknowledge the view_submission event
    await ack();

    console.log(JSON.stringify(view.state.values))
    const user = body.user.id;

    // Message the user
    try {
        const summary = view.state.values.summary.title.value
        const environment = view.state.values.environment.environment.selected_option?.text.text || "None"
        const jiraId = "DTSPO-1111"

        const result = await client.chat.postMessage({
            channel: reportChannel,
            text: 'New platform help request raised',
            blocks: helpRequestRaised(user, summary, environment, 'Unassigned', jiraId)
        });
    } catch (error) {
        console.error(error);
    }

});


// subscribe to 'app_mention' event in your App config
// need app_mentions:read and chat:write scopes
app.event('app_mention', async ({event, context, client, say}) => {
    try {
        await say({
            "blocks": [
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
            ]
        });
    } catch (error) {
        console.error(error);
    }
});

// subscribe to `message.channels` event in your App Config
// need channels:read scope
app.message('hello', async ({message, say}) => {
    // say() sends a message to the channel where the event was triggered
    // no need to directly use 'chat.postMessage', no need to include token
    await helloToBotHandler({message, say});
});

// Listen and respond to button click
app.action('first_button', async ({action, ack, say, context}) => {
    console.log('button clicked');
    console.log(action);
    // acknowledge the request right away
    await ack();
    await say('Thanks for clicking the fancy button');
});


function randomString() {
    return crypto.randomBytes(16).toString("hex");
}

app.action('assign_help_request_to_me', async ({
                                                   body, action, ack, client, context
                                               }) => {
    await ack();
    const blocks = body.message.blocks
    const assignedToSection = blocks[4]
    assignedToSection.accessory.initial_user = body.user.id
    // work around issue where 'initial_user' doesn't update if someone selected a user in dropdown
    assignedToSection.block_id = `new_block_id_${randomString().substring(0, 8)}`;

    const result = await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: 'New platform help request raised',
        blocks: blocks
    });

})

app.action('resolve_help_request', async ({
                                              body, action, ack, client, context
                                          }) => {
    await ack();
    console.log('TODO implement resolve_help_request')
});

app.action('assign_help_request_to_user', async ({
                                                     body, action, ack, client, context
                                                 }) => {
    await ack();
    console.log('TODO implement assign_help_request_to_user')
});

// Listen to slash command
// need to add commands permission
// create slash command in App Config
app.command('/socketslash', async ({command, ack, say}) => {
    // Acknowledge command request
    await ack();

    await say(`${command.text}`);
});
