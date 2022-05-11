const config = require('@hmcts/properties-volume').addTo(require('config'))
const setupSecrets = require('./src/setupSecrets');
// must be called before any config.get calls
setupSecrets.setup();

// Slack message generator functions, each of these return a JSON object valid
// for use with slack's block framework. These can then be used to post forms
// and formatted messages within slack: https://api.slack.com/block-kit
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

// Import slack's Bolt API. This is the primary way the bot communicates with
// slack: https://api.slack.com/bolt
const { App, LogLevel, SocketModeReceiver, WorkflowStep } = require('@slack/bolt');
const crypto = require('crypto')

// Jira functions. These are wrapper functions for the jira-client npm package
// which itself is a wrapper around Jira's REST API:
// https://www.npmjs.com/package/jira-client
const {
    addCommentToHelpRequest,
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

// Import and enable Azure AppInsights. Instrumentation key can be configured
// using the APP_INSIGHTS_INSTRUMENTATION_KEY environment variable. In prod,
// this reports to cft-platform-prod. If running locally, consider reporting
// to cft-platform-sbox
const appInsights = require('./src/modules/appInsights')
appInsights.enableAppInsights()

// Create slack bolt app. Bot token and app token can be configured using the
// SLACK_BOT_TOKEN and SLACK_APP_TOKEN environment variables. See README.md for
// details on how to set up a bot and obtain these tokens.
const app = new App({
    token: config.get('slack.bot_token'), //disable this if enabling OAuth in socketModeReceiver
    // logLevel: LogLevel.DEBUG,
    appToken: config.get('slack.app_token'),
    socketMode: true,
});

// Set the channel the bot will post messages to. Unfortunately couldn't find
// a way to look up the channel id via the API, so it must be provided here as
// well. These can be configured using the SLACK_REPORT_CHANNEL and
// SLACK_REPORT_CHANNEL_ID environment variables. In slack, the channel id can
// be found by right-clicking the channel name in the sidebar and clicking
// 'Open channel details'. The channel ID can then be found at the bottom of
// the popup.
const reportChannel = config.get('slack.report_channel');
const reportChannelId = config.get('slack.report_channel_id');

// Set up health and readiness pages, this is a simple node server that reports
// basic runtime info about the bot. Can be accessed by visiting localhost:3000
// in your browser while running the bot locally
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

// Start the slack bolt app
(async () => {
    await app.start();
    console.log('⚡️ Bolt app started');
})();

// New slack workflow for the slack-help-bot. Workflow steps are fully
// managed by code but must be integrated into a slack workflow via the
// workflow builder.
// TODO: https://tools.hmcts.net/jira/browse/DTSPO-7541
const ws = new WorkflowStep('superbot_help_request', {
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

        // skip_variable_replacement does something we don't want,
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
        // Called when the workflow step is
        // invoked by somebody from inside of
        // slack. This is the workflow step
        // responsible for actually doing things.

        const { inputs } = step;
        console.log("Slack workflow has been executed: " + JSON.stringify(inputs));

        const user = inputs.user.value;

        // Find the email of the ticket reporter. This is used to find their
        // Jira account so they can be listed as the reporter when the ticket
        // is created. If a user with that email is not found, the ticket
        // reporter is set to the defailt: 'Generic RW'
        const userEmail = (await client.users.profile.get({
            user
        })).profile.email

        // Generate the help request object 
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

        // Create the help request ticket in Jira and get the ticket id.
        // using JIRA version v8.15.0#815001-sha1:9cd993c:node1,
        // check if API is up-to-date
        const jiraId = await createHelpRequest({
            summary: helpRequest.summary,
            userEmail,
            // Jira labels go here, these can't contain spaces so we substitute
            // them for '-' characters
            // TODO: Add more labels?
            labels: [
                `area-${inputs.area.value.toLowerCase().replace(' ', '-')}`,
                `team-${inputs.team.value.toLowerCase().replace(' ', '-')}`
            ]
        });

        // Send the 'help request raised' message to the report channel,
        // pointing it to the Jira ticket we created
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

        // Send the details of the help request in a reply to the first message
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

        // Get a link to the slack thread we just created
        const permaLink = (await client.chat.getPermalink({
            channel: result.channel,
            'message_ts': result.message.ts
        })).permalink

        // Update the Jira ticket to point to the slack thread
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

// Old method of raising the help request form using slack shortcuts instead of
// workflow steps. Shortcut is still active in slack, but should be removed.

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

// 'Old' method of creating the help request once the form has been submitted.
// This uses app views instead of slack workflows which are now preferred.
app.view('create_help_request', async ({ ack, body, view, client }) => {

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

// Callback triggered when someone clicks the 'Take it' button on a help
// request message posted by the bot.
app.action('assign_help_request_to_me', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack();

        // Get the Jira id from the help request message posted to slack
        const jiraId = extractJiraIdFromBlocks(body.message.blocks)

        // Get the email of the user from their slack profile
        const userEmail = (await client.users.profile.get({
            user: body.user.id
        })).profile.email

        // Assign the help request in Jira to the user who clicked the button
        await assignHelpRequest(jiraId, userEmail)

        const blocks = body.message.blocks
        const assignedToSection = blocks[6]
        assignedToSection.elements[0].initial_user = body.user.id
        // work around issue where 'initial_user' doesn't update if someone selected a user in dropdown
        // assignedToSection.block_id = `new_block_id_${randomString().substring(0, 8)}`;

        // Update the Message in slack to reflect that someone is now assigned
        // to the help request
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

// Callback triggered when someone clicks the 'Resolve' button on a help
// request message posted by the bot.
app.action('resolve_help_request', async ({
    body, action, ack, client, context, payload
}) => {
    try {
        await ack();

        // Trigger IDs have a short lifespan, so process them first; show the
        // ticket closure form to the user who clicked the button.
        await client.views.open({
            trigger_id: body.trigger_id,
            view: resolveHelpRequestBlocks({thread_ts: body.message.ts}),
        });

        // Get the Jira id from the help request message posted to slack
        const jiraId = extractJiraIdFromBlocks(body.message.blocks)

        // Transitions the Jira ticket from 'In Progress' to 'Done'
        // The transition ID taken can be configured with the
        // JIRA_DONE_TRANSITION_ID environment variable
        await resolveHelpRequest(jiraId)

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

        // Update the message in slack to reflect that the help request is now
        // resolved.
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

// Callback triggered when someone submits the documentation form for a
// resolved help request
app.view('document_help_request', async ({ ack, body, view, client }) => {
    try{
        await ack();

        //console.log(JSON.stringify(body, null, 2));

        const documentation = {
            what: body.view.state.values.what_block.what.value,
            where: body.view.state.values.where_block.where.value,
            how: body.view.state.values.how_block.how.value,
        };

        // Post a message containing the documentation the user entered
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

// Callback triggered when someone clicks the 'Start' button on a help
// request message posted by the bot.
app.action('start_help_request', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack();

        // Get the Jira id from the help request message posted to slack
        const jiraId = extractJiraIdFromBlocks(body.message.blocks)

        // Transitions the Jira ticket from its initial state to 'In Progress'
        // The transition ID taken can be configured with the
        // JIRA_START_TRANSITION_ID environment variable
        await startHelpRequest(jiraId);

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

        // Update the message in slack to reflect that the help request is now
        // in progress.
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

// Callback triggered when someone selects a user from the drop-down menu on
// a help request message posted by the bot.
app.action('assign_help_request_to_user', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack();

        const user = action.selected_user

        // Get the Jira id from the help request message posted to slack
        const jiraId = extractJiraIdFromBlocks(body.message.blocks)

        // Get the email of the user selected in the drop-down menu from their
        // slack profile
        const userEmail = (await client.users.profile.get({
            user
        })).profile.email

        // Assign the help request in Jira to the user selected in the menu
        await assignHelpRequest(jiraId, userEmail)

        const actor = body.user.id

        // Notify the user that they have been assigned to the help request
        // by the perso who selected them from the menu
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
