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
    duplicateHelpRequest,
    resolveHelpRequestBlocks,
    helpRequestDocumentation,
} = require("./src/messages");
const { App, LogLevel, SocketModeReceiver, WorkflowStep } = require('@slack/bolt');
const crypto = require('crypto')
const {
    addCommentToHelpRequestResolve,
    addCommentToHelpRequest,
    addLabel,
    assignHelpRequest,
    createHelpRequest,
    extraJiraId,
    extractJiraIdFromBlocks,
    resolveHelpRequest,
    searchForUnassignedOpenIssues,
    startHelpRequest,
    updateHelpRequestDescription,
    getIssueDescription, markAsDuplicate
} = require("./src/service/persistence");
const appInsights = require('./src/modules/appInsights')

appInsights.enableAppInsights()

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
const { report } = require('process');
const port = process.env.PORT || 3000

const server = http.createServer((req, res) => {
    appInsights.client().trackNodeHttpRequest({request: req, response: res});
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end("error")
    } else if (req.url === '/health') {
        const connectionError = app.receiver.client.badConnection;
        if (connectionError) {
            res.statusCode = 500;
        } else {
            res.statusCode = 200;
        }
        const myResponse = {
            status: "UP",
            slack: {
                connection: connectionError ? "DOWN" : "UP",
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
        });

        const result = await client.chat.postMessage({
            channel: reportChannel,
            text: 'New platform help request raised',
            blocks: helpRequestRaised({
                ...helpRequest,
                jiraId
            })
        });
      
        if (!result.ok)
        {
            console.log("An error occurred when posting to Slack: " + JSON.stringify(result));
        }

        const response = await client.chat.postMessage({
            channel: reportChannel,
            thread_ts: result.message.ts,
            text: 'New platform help request raised',
            blocks: helpRequestDetails(helpRequest)
        });

        if (!response.ok)
        {
            console.log("An error occurred when posting to Slack: " + JSON.stringify(response))
            return;
        }

        const permaLink = (await client.chat.getPermalink({
            channel: result.channel,
            'message_ts': result.message.ts
        })).permalink

        await updateHelpRequestDescription(jiraId, {
            ...helpRequest,
            slackLink: permaLink
        });

        complete();
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

// Message Shortcut example
app.shortcut('launch_msg_shortcut', async ({ shortcut, body, ack, context, client }) => {
    await ack();
});

// Global Shortcut example
// setup global shortcut in App config with `launch_shortcut` as callback id
// add `commands` scope
app.shortcut('launch_shortcut', async ({ shortcut, body, ack, context, client }) => {
    try {
        // Acknowledge shortcut request
        await ack();

        // Un-comment if you want the JSON for block-kit builder (https://app.slack.com/block-kit-builder/T1L0WSW9F)
        // console.log(JSON.stringify(openHelpRequestBlocks().blocks))

        await client.views.open({
            trigger_id: shortcut.trigger_id,
            view: openHelpRequestBlocks()
        });
    } catch (error) {
        console.error(error);
    }
});

function extractLabels(values) {
    const team = `team-${values.team.team.selected_option.value}`
    const area = `area-${values.area.area.selected_option.value}`
    return [area, team];
}

app.view('create_help_request', async ({ ack, body, view, client }) => {
    ////////////////////////////////////////////////////////////
    //// SuperBot: This entry point isn't used anymore, but ////
    ////           we can keep it around just in case :)    ////
    ////////////////////////////////////////////////////////////

    // Acknowledge the view_submission event
    await ack();

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
            prBuildUrl: view.state.values.urls?.title?.value || "None",
            description: view.state.values.description.description.value,
            checkedWithTeam: view.state.values.checked_with_team.checked_with_team.selected_option.value,
            analysis: view.state.values.analysis.analysis.value,
        }

        const jiraId = await createHelpRequest({
            summary: helpRequest.summary,
            userEmail,
            labels: extractLabels(view.state.values)
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
app.event('app_mention', async ({ event, context, client, say }) => {
    try {
        // filter unwanted channels in case someone invites the bot to it
        // and only look at threaded messages
        if (event.channel === reportChannelId && event.thread_ts) {
            const helpRequestMessages = (await client.conversations.replies({
                channel: reportChannelId,
                ts: event.thread_ts,
                limit: 200, // after a thread is 200 long we'll break but good enough for now
            })).messages

            if (helpRequestMessages.length > 0 && helpRequestMessages[0].text === 'New platform help request raised') {
                if (event.text.includes('help')) {
                    const usageMessage = `Hi <@${event.user}>, here is what I can do:
\`duplicate\ [JiraID]\` - Marks this ticket as a duplicate of the specified ID`

                    await say({
                        text: usageMessage,
                        thread_ts: event.thread_ts
                    });
                } else if (event.text.includes('duplicate')) {
                    const result = event.text.match(/.+duplicate ([A-Z]+-[0-9]+)/);
                    if (result) {
                        const blocks = helpRequestMessages[0].blocks
                        const summary = extractSummaryFromBlocks(blocks)
                        const parentJiraId = result[1];
                        const issueDescription = await getIssueDescription(parentJiraId)

                        if (issueDescription === undefined) {
                            await say({
                                text: `Hi <@${event.user}>, I couldn't find that Jira ID, please check and try again.`,
                                thread_ts: event.thread_ts
                            });
                            return;
                        }

                        const parentSlackUrl = extractSlackLinkFromText(issueDescription)
                        const currentIssueJiraId = extractJiraIdFromBlocks(blocks)

                        await markAsDuplicate(currentIssueJiraId, parentJiraId)

                        await client.chat.update({
                            channel: event.channel,
                            ts: helpRequestMessages[0].ts,
                            text: 'Duplicate issue',
                            blocks: duplicateHelpRequest({
                                summary,
                                parentJiraId,
                                parentSlackUrl,
                                currentIssueJiraId
                            })
                        });

                        await client.reactions.add({
                            name: 'white_check_mark',
                            timestamp: event.ts,
                            channel: event.channel
                        });

                    } else {
                        await say({
                            text: `Hi <@${event.user}>, I couldn't find that Jira ID, please check and try again.`,
                            thread_ts: event.thread_ts
                        });
                    }


                } else {
                    await say({
                        text: `Hi <@${event.user}>, if you want to escalate a request please tag \`platformops-bau\`, to see what else I can do reply back with \`help\``,
                        thread_ts: event.thread_ts
                    });
                }

            }
        }
    } catch (error) {
        console.error(error);
    }
});

function extractSummaryFromBlocks(blocks) {
    return blocks[0].text.text
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
    body, action, ack, client, context, payload
}) => {
    try {
        await ack();

        // Trigger IDs have a short lifespan, so process them first
        await client.views.open({
            trigger_id: body.trigger_id,
            view: resolveHelpRequestBlocks({thread_ts: body.message.ts}),
        });

    } catch (error) {
        console.error(error);
    }
});

app.view('document_help_request', async ({ ack, body, view, client }) => {
    try{
        await ack();

        const helpRequestMessages = (await client.conversations.replies({
            channel: reportChannelId,
            ts: body.view.private_metadata,
            limit: 200, // after a thread is 200 long we'll break but good enough for now
        })).messages

        const jiraId = extractJiraIdFromBlocks(helpRequestMessages[0].blocks)

        await resolveHelpRequest(jiraId)

        const blocks = helpRequestMessages[0].blocks
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
            channel: reportChannelId,
            ts: body.view.private_metadata,
            text: 'New platform help request raised',
            blocks: blocks
        });
        
        const documentation = {
            category:   body.view.state.values.category_block.category.selected_option.value,
            how: body.view.state.values.how_block.how.value,
        };

        await addCommentToHelpRequestResolve(jiraId, documentation)
            
        await addLabel(jiraId, documentation)

        await client.chat.postMessage({
            channel: reportChannel,
            thread_ts: body.view.private_metadata,
            text: 'Platform help request documented',
            blocks: helpRequestDocumentation(documentation)
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

/**
 * Users may have a display name set or may not.
 * Display name is normally better than real name, so we prefer that but fallback to real name.
 */
function convertProfileToName(profile) {
    let name = profile.display_name_normalized
    if (!name) {
        name = profile.real_name_normalized;
    }
    return name;
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

            const name = convertProfileToName(user.profile);

            const helpRequestMessages = (await client.conversations.replies({
                channel: reportChannelId,
                ts: event.thread_ts,
                limit: 200, // after a thread is 200 long we'll break but good enough for now
            })).messages

            if (helpRequestMessages.length > 0 && (
                helpRequestMessages[0].text === 'New platform help request raised' ||
                helpRequestMessages[0].text === 'Duplicate issue')
            ) {
                const jiraId = extractJiraIdFromBlocks(helpRequestMessages[0].blocks)

                const groupRegex = /<!subteam\^.+\|([^>.]+)>/g
                const usernameRegex = /<@([^>.]+)>/g

                let possibleNewTargetText = event.text.replace(groupRegex, (match, $1) => $1)

                const newTargetText = await replaceAsync(possibleNewTargetText, usernameRegex, async (match, $1) => {
                    const user = (await client.users.profile.get({
                        user: $1
                    }))
                    return `@${convertProfileToName(user.profile)}`
                });

                await addCommentToHelpRequest(jiraId, {
                    slackLink,
                    name,
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
