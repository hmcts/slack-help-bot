const {helpRequestDetails, helpRequestRaised, openHelpRequestBlocks} = require("./src/messages");
const {App, LogLevel, SocketModeReceiver} = require('@slack/bolt');
const crypto = require('crypto')
const {
    addCommentToHelpRequest,
    assignHelpRequest,
    createHelpRequest,
    extractJiraId,
    resolveHelpRequest,
    updateHelpRequestDescription
} = require("./src/service/persistence");

const app = new App({
    token: process.env.SLACK_BOT_TOKEN, //disable this if enabling OAuth in socketModeReceiver
    // logLevel: LogLevel.DEBUG,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
});

const reportChannel = process.env.REPORT_CHANNEL;
// can't find an easy way to look this up via API unfortunately :(
const reportChannelId = process.env.REPORT_CHANNEL_ID;

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

        const userEmail = (await client.users.profile.get({
            user
        })).profile.email

        const helpRequest = {
            user,
            summary: view.state.values.summary.title.value,
            environment: view.state.values.environment.environment.selected_option?.text.text || "None",
            prBuildUrl: view.state.values.urls?.title?.value,
            description: view.state.values.description.description.value,
            checkedWithTeam: view.state.values.checked_with_team.checked_with_team.selected_option.value,
            analysis: view.state.values.analysis.analysis.value,
        }

        const jiraId = await createHelpRequest({
            summary: helpRequest.summary,
            userEmail
        })

        const result = await client.chat.postMessage({
            channel: reportChannel,
            text: 'New platform help request raised',
            blocks: helpRequestRaised({
                ...helpRequest,
                jiraId
            })
        });

        await client.chat.postMessage({
            channel: reportChannel,
            thread_ts: result.message.ts,
            text: 'New platform help request raised',
            blocks: helpRequestDetails(helpRequest)
        });

        const permaLink = (await client.chat.getPermalink({
            channel: result.channel,
            'message_ts': result.message.ts
        })).permalink

        await updateHelpRequestDescription(jiraId, {
            ...helpRequest,
            slackLink: permaLink
        })
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
                        "text": `Thanks for the mention <@${event.user}>!`
                    },
                }
            ]
        });
    } catch (error) {
        console.error(error);
    }
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
    const jiraId = extractJiraId(body.message.blocks[5].elements[0].text)

    await resolveHelpRequest(jiraId) // TODO add optional resolution comment

    // TODO update the slack message to look different
    // TODO add re-open button?
});

app.action('assign_help_request_to_user', async ({
                                                     body, action, ack, client, context
                                                 }) => {
    await ack();

    body.state.values

    const blockName = Object.keys(body.state.values)[0]
    const user = body.state.values[blockName].assign_help_request_to_user.selected_user


    const jiraId = extractJiraId(body.message.blocks[5].elements[0].text)
    const userEmail = (await client.users.profile.get({
        user
    })).profile.email

    await assignHelpRequest(jiraId, userEmail)

    const actor = body.user.id

    await client.chat.postMessage({
        channel: body.channel.id,
        thread_ts: body.message.ts,
        text: `Hi, <@${user}>, you've just been assigned to this help request by <@${actor}>`
    });
});

// Listen to slash command
// need to add commands permission
// create slash command in App Config
app.command('/socketslash', async ({command, ack, say}) => {
    // Acknowledge command request
    await ack();

    await say(`${command.text}`);
});

app.event('message', async ({event, context, client, say}) => {
    // filter unwanted channels in case someone invites the bot to it
    // and only look at threaded messages
    if (event.channel === reportChannelId && event.thread_ts) {
        const slackLink = (await client.chat.getPermalink({
            channel: event.channel,
            'message_ts': event.thread_ts
        })).permalink

        const user = (await client.users.profile.get({
            user: event.user
        }))

        console.log(user)

        const displayName = user.profile.display_name

        const helpRequestMessages = (await client.conversations.replies({
            channel: reportChannelId,
            ts: event.thread_ts,
            limit: 200, // after a thread is 200 long we'll break but good enough for now
        })).messages

        if (helpRequestMessages.length > 0 && helpRequestMessages[0].text === 'New platform help request raised') {
            const jiraId = extractJiraId(helpRequestMessages[0].blocks[5].elements[0].text)

            await addCommentToHelpRequest(jiraId, {
                slackLink,
                displayName,
                message: event.text
            })
        } else {
            // either need to implement pagination or find a better way to get the first message in the thread
            console.warn("Could not find jira ID, possibly thread is longer than 200 messages, TODO implement pagination");
        }

    }
})
