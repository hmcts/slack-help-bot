const config = require('@hmcts/properties-volume').addTo(require('config'))
const setupSecrets = require('./src/setupSecrets');
// must be called before any config.get calls
setupSecrets.setup();

const {
    appHomeUnassignedIssues,
    extractSlackLinkFromText,
    extractSlackMessageIdFromText,
    helpRequestDetails,
    helpRequestRaised,
    openHelpRequestBlocks,
    superBotMessageBlocks,
    unassignedOpenIssue,
} = require("./src/messages");
const { App, LogLevel, SocketModeReceiver, WorkflowStep } = require('@slack/bolt');
const crypto = require('crypto')
const {
    addCommentToHelpRequest,
    assignHelpRequest,
    createHelpRequest,
    extraJiraId,
    extractJiraIdFromBlocks,
    resolveHelpRequest,
    searchForUnassignedOpenIssues,
    startHelpRequest,
    updateHelpRequestDescription
} = require("./src/service/persistence");

///////////////////////////
//// Setup AppInsights ////
///////////////////////////

let appInsights = require('applicationinsights');

appInsights.setup(config.get('app_insights.instrumentation_key'))
    .setAutoCollectConsole(true, true);
appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = config.get('app_insights.role_name');
appInsights.start();

/////////////////////////
//// Setup Slack app ////
/////////////////////////

const app = new App({
    token: config.get('slack.bot_token'), //disable this if enabling OAuth in socketModeReceiver
    // logLevel: LogLevel.DEBUG,
    appToken: config.get('slack.app_token'),
    socketMode: true,
});

const reportChannel = config.get('slack.report_channel');
// can't find an easy way to look this up via API unfortunately :(
const reportChannelId = config.get('slack.report_channel_id');

//////////////////////////////////
//// Setup health check page /////
//////////////////////////////////

const http = require('http');
const port = process.env.PORT || 3000

var isJiraOkay = true;
var isSlackOkay = true;

const server = http.createServer((req, res) => { 
    appInsights.defaultClient.trackNodeHttpRequest({request: req, response: res});
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end("error")
    } else if (req.url === '/health') {
        if ((!app.receiver.client.badConnection) && isJiraOkay && isSlackOkay) {
            res.statusCode = 200;
        } else {
            res.statusCode = 500;
        }
        myResponse = {
            status: "UP",
            slack: {
                connection: (app.receiver.client.badConnection ? "DOWN" : "UP"),
                status: (isSlackOkay ? "UP" : "DOWN"),
            },
            jira: {
                status: (isJiraOkay ? "UP" : "DOWN"),
            },
            node: {
                uptime: process.uptime(),
                time: new Date().toString(),
            }
        };
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(myResponse))
    } else if (req.url === '/health/liveness') {
        if (app.receiver.client.badConnection) {
            res.statusCode = 500
            res.end('Internal Server Error');
            return;
        }
        res.end('OK');
    } else if (req.url === '/health/readiness') {
        res.end(`<h1>slack-help-bot</h1>`)
    } else if (req.url === '/health/error') {
        // Dummy error page
        res.statusCode = 500;
        res.end(`{"error": "${http.STATUS_CODES[500]}"}`)
    } else {
        res.statusCode = 404;
        res.end(`{"error": "${http.STATUS_CODES[404]}"}`)
    }
})

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

//////////////////////////
//// Setup Slack Bolt ////
//////////////////////////

(async () => {
    await app.start();
    console.log('⚡️ Bolt app started');
})();

const ws = new WorkflowStep('superbot_help_request', {
    ////////////////////////////////////
    ////  New workflow for SuperBot ////
    ////////////////////////////////////
    //// This can be added directly ////
    ////  into the workflow builder ////
    ////   in Slack, just give the  ////
    ////  user a form or something  ////
    ////     to fill out first.     ////
    ////////////////////////////////////

    edit: async ({ ack, step, configure }) => {
        // Called when the workflow step is
        // added/edited in the Slack workflow
        // builder. This is what generates the
        // customization form when you click 'edit'
        await ack();
        console.log('Slack workflow editor has been opened: ' + JSON.stringify(step))

        const blocks = superBotMessageBlocks(step.inputs);
        await configure({ blocks });
    },
    save: async ({ ack, step, view, update, client }) => {
        // Called when the workflow step is
        // saved in the Slack workflow
        // builder. This is responsible for
        // updating the inputs in this stage
        // when 'save' is clicked on the 'edit'
        // form
        await ack();
        const { values } = view.state;
        
        console.log('Slack workflow has been changed: ' + JSON.stringify(values));

        // names/paths of these values must match those in the 
        // 'action_id' and 'block_id' parameters in original form.
        // See src/messages.js:superBotMessageBlocks(inputs)
        const summary = values.summary_block.summary_input;
        const env = values.env_block.env_input;
        const team = values.team_block.team_input;
        const area = values.area_block.area_input;
        const build = values.build_block.build_input;
        const desc = values.desc_block.desc_input;
        const alsys = values.alsys_block.alsys_input;
        const team_check = values.team_check_block.team_check_input;
        const user = values.user_block.user_input;

        // skip_variable_replacement does something,
        // I honestly can't tell from slack's documentation.
        const inputs = {
            summary: {
                value: summary.value,
                skip_variable_replacement: false
            },
            env: {
                value: env.value,
                skip_variable_replacement: false
            },
            team: {
                value: team.value,
                skip_variable_replacement: false
            },
            area: {
                value: area.value,
                skip_variable_replacement: false
            },
            build: {
                value: build.value,
                skip_variable_replacement: false
            },
            desc: {
                value: desc.value,
                skip_variable_replacement: false
            },
            alsys: {
                value: alsys.value,
                skip_variable_replacement: false
            },
            team_check: {
                value: team_check.value,
                skip_variable_replacement: false
            },
            user: {
                value: user.selected_user,
                skip_variable_replacement: false
            },
        };

        const outputs = [ ];

        await update({ inputs, outputs });
    },
    execute: async ({ step, complete, fail, client }) => {
        
        const { inputs } = step;
        console.log("Slack workflow has been executed: " + JSON.stringify(inputs));

        const user = inputs.user.value;

        //TODO: Do we send user emails?
        const userEmail = (await client.users.profile.get({
            user
        })).profile.email

        const helpRequest = {
            user,
            summary: inputs.summary.value || "None",
            environment: inputs.env.value || "None",
            team: inputs.team.value || "None",
            area: inputs.area.value || "None",
            prBuildUrl: inputs.build.value || "None",
            description: inputs.desc.value,
            checkedWithTeam: inputs.team_check.value,
            analysis: inputs.alsys.value
        }

        // using JIRA version v8.15.0#815001-sha1:9cd993c:node1,
        // check if API is up-to-date
        const jiraId = await createHelpRequest({
            summary: helpRequest.summary,
            userEmail,
            // Jira labels go here, can't contain spaces btw
            // TODO: Put this in a function?
            // TODO: Add more labels?
            labels: [
                `area-${inputs.area.value.toLowerCase().replace(' ', '-')}`,
                `team-${inputs.team.value.toLowerCase().replace(' ', '-')}`
            ]
        })

        const result = await client.chat.postMessage({
            channel: reportChannel,
            text: 'New platform help request raised',
            blocks: helpRequestRaised({
                ...helpRequest,
                jiraId
            })
        });

        isJiraOkay = result.ok;

        // TODO: This doesn't actually check if JIRA is okay,
        //       it only checks the message sent to slack :/
        if (!isJiraOkay)
        {
            console.log("An error occured when posting to JIRA: " + JSON.stringify(result));
        }

        const response = await client.chat.postMessage({
            channel: reportChannel,
            thread_ts: result.message.ts,
            text: 'New platform help request raised',
            blocks: helpRequestDetails(helpRequest)
        });

        isSlackOkay = response.ok;

        if (!isSlackOkay)
        {
            console.log("An error occured when posting to Slack: " + JSON.stringify(response))
        }

        const permaLink = (await client.chat.getPermalink({
            channel: result.channel,
            'message_ts': result.message.ts
        })).permalink

        await updateHelpRequestDescription(jiraId, {
            ...helpRequest,
            slackLink: permaLink
        })
    },
});

app.step(ws);

/////////////////////////////
//// Setup App Homepage  ////
/////////////////////////////
//// I don't think we're ////
//// actually using this ////
/////////////////////////////

async function reopenAppHome(client, userId) {
    const results = await searchForUnassignedOpenIssues()

    const parsedResults = results.issues.flatMap(result => {
        return unassignedOpenIssue({
            summary: result.fields.summary,
            slackLink: extractSlackLinkFromText(result.fields.description),
            jiraId: result.key,
            created: result.fields.created,
            updated: result.fields.updated,
        })
    })

    await client.views.publish({
        user_id: userId,
        view: {
            type: "home",
            blocks: appHomeUnassignedIssues(parsedResults)
        },
    });
}

// Publish a App Home
app.event('app_home_opened', async ({ event, client }) => {
    await reopenAppHome(client, event.user);
});

// subscribe to 'app_mention' event in your App config
// need app_mentions:read and chat:write scopes
app.event('app_mention', async ({ event, context, client, say }) => {
    try {
        await say({
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Thanks for the ping <@${event.user}>!`
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
    try {
        await ack();

        const jiraId = extractJiraIdFromBlocks(body.message.blocks)
        const userEmail = (await client.users.profile.get({
            user: body.user.id
        })).profile.email

        await assignHelpRequest(jiraId, userEmail)

        const blocks = body.message.blocks
        const assignedToSection = blocks[6]
        assignedToSection.elements[0].initial_user = body.user.id
        // work around issue where 'initial_user' doesn't update if someone selected a user in dropdown
        // assignedToSection.block_id = `new_block_id_${randomString().substring(0, 8)}`;

        await client.chat.update({
            channel: body.channel.id,
            ts: body.message.ts,
            text: 'New platform help request raised',
            blocks: blocks
        });
    } catch (error) {
        console.error(error);
    }

})

app.action('resolve_help_request', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack();
        const jiraId = extractJiraIdFromBlocks(body.message.blocks)

        await resolveHelpRequest(jiraId) // TODO add optional resolution comment

        const blocks = body.message.blocks
        // TODO less fragile block updating
        blocks[6].elements[2] = {
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": ":snow_cloud: Re-open",
                "emoji": true
            },
            "style": "primary",
            "value": "start_help_request",
            "action_id": "start_help_request"
        }

        blocks[2].fields[0].text = "Status :snowflake:\n Done"

        await client.chat.update({
            channel: body.channel.id,
            ts: body.message.ts,
            text: 'New platform help request raised',
            blocks: blocks
        });
    } catch (error) {
        console.error(error);
    }
});


app.action('start_help_request', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack();
        const jiraId = extractJiraIdFromBlocks(body.message.blocks)

        await startHelpRequest(jiraId) // TODO add optional resolution comment

        const blocks = body.message.blocks
        // TODO less fragile block updating
        blocks[6].elements[2] = {
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": ":snow_cloud: Resolve",
                "emoji": true
            },
            "style": "primary",
            "value": "resolve_help_request",
            "action_id": "resolve_help_request"
        }

        blocks[2].fields[0].text = "Status :fire_extinguisher:\n In progress"

        await client.chat.update({
            channel: body.channel.id,
            ts: body.message.ts,
            text: 'New platform help request raised',
            blocks: blocks
        });
    } catch (error) {
        console.error(error);
    }
});

app.action('app_home_unassigned_user_select', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack();

        const user = action.selected_user
        const userEmail = (await client.users.profile.get({
            user
        })).profile.email

        const jiraId = extraJiraId(action.block_id)
        await assignHelpRequest(jiraId, userEmail)

        await reopenAppHome(client, user);
    } catch (error) {
        console.error(error);
    }
})

function extractSlackMessageId(body, action) {
    let result
    for (let i = 0; i < body.view.blocks.length; i++) {
        if (body.view.blocks[i].block_id === action.block_id) {
            const slackLink = body.view.blocks[i - 1].text.text
            return extractSlackMessageIdFromText(slackLink)
        }
    }
    return result
}

app.action('app_home_take_unassigned_issue', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack();

        const user = body.user.id
        const userEmail = (await client.users.profile.get({
            user
        })).profile.email

        const jiraId = extraJiraId(action.block_id)
        const slackMessageId = extractSlackMessageId(body, action);

        await assignHelpRequest(jiraId, userEmail)

        await reopenAppHome(client, user);
    } catch (error) {
        console.error(error);
    }
})

app.action('assign_help_request_to_user', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack();

        const user = action.selected_user

        const jiraId = extractJiraIdFromBlocks(body.message.blocks)
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
    } catch (error) {
        console.error(error);
    }
});

/**
 * The built in string replace function can't return a promise
 * This is an adapted version that is able to do that
 * Source: https://stackoverflow.com/a/48032528/4951015
 *
 * @param str source string
 * @param regex the regex to apply to the string
 * @param asyncFn function to transform the string with, arguments should include match and any capturing groups
 * @returns {Promise<*>} result of the replace
 */
async function replaceAsync(str, regex, asyncFn) {
    const promises = [];
    str.replace(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
}

app.event('message', async ({ event, context, client, say }) => {
    try {
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

            const displayName = user.profile.display_name

            const helpRequestMessages = (await client.conversations.replies({
                channel: reportChannelId,
                ts: event.thread_ts,
                limit: 200, // after a thread is 200 long we'll break but good enough for now
            })).messages

            if (helpRequestMessages.length > 0 && helpRequestMessages[0].text === 'New platform help request raised') {
                const jiraId = extractJiraIdFromBlocks(helpRequestMessages[0].blocks)

                const groupRegex = /<!subteam\^.+\|([^>.]+)>/g
                const usernameRegex = /<@([^>.]+)>/g

                let possibleNewTargetText = event.text.replace(groupRegex, (match, $1) => $1)

                const newTargetText = await replaceAsync(possibleNewTargetText, usernameRegex, async (match, $1) => {
                    const user = (await client.users.profile.get({
                        user: $1
                    }))
                    return `@${user.profile.display_name}`
                });

                await addCommentToHelpRequest(jiraId, {
                    slackLink,
                    displayName,
                    message: newTargetText
                })
            } else {
                // either need to implement pagination or find a better way to get the first message in the thread
                console.warn("Could not find jira ID, possibly thread is longer than 200 messages, TODO implement pagination");
            }
        }
    } catch (error) {
        console.error(error);
    }
})
