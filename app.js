const config = require('@hmcts/properties-volume').addTo(require('config'))
const setupSecrets = require('./src/setupSecrets');
// must be called before any config.get calls
setupSecrets.setup();

const {
    helpFormGreetingBlocks,
    helpFormPlatoBlocks,
    helpFormMainBlocks,
    helpFormGoodbyeBlocks,

    helpRequestMainBlocks,
    helpRequestDetailBlocks,
    helpRequestDuplicateBlocks,
    helpRequestResolveBlocks,
    helpRequestDocumentationBlocks,

    appHomeMainBlocks,
    appHomeIssueBlocks,

    appHomeHeaderBlocks,

    configureWorkflowStepBlocks
} = require("./src/messages");

const {
    extractSlackLinkFromText,
    extractSlackMessageIdFromText,
} = require('./src/messages/util');

const { App, LogLevel, SocketModeReceiver, WorkflowStep, WorkflowStepInitializationError } = require('@slack/bolt');
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
    searchForOpenIssues,
    searchForIssuesAssignedTo,
    searchForIssuesRaisedBy,
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
const port = process.env.PORT || 3000

const server = http.createServer((req, res) => {
    appInsights.client().trackNodeHttpRequest({ request: req, response: res });
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

// Standard way of checking a response from slack
function checkSlackResponseError(res, message) {
    if (!res.ok) {
        throw new Error(message + ': ' + JSON.stringify(res))
    }
}

(async () => {
    await app.start();
    console.log('⚡️ Bolt app started');
})();

// Main entry point for the workflow
const nws = new WorkflowStep('begin_help_request', {
    edit: async ({ ack, step, configure }) => {
        await ack()
        const blocks = configureWorkflowStepBlocks(step.inputs)
        await configure({ blocks })
    },
    save: async ({ ack, step, view, update, client }) => {
        await ack()

        const { values } = view.state;
        const user = values.user_block.user_input

        const inputs = {
            user: {
                value: user.selected_user,
                skip_variable_replacement: false
            },
        }
        const outputs = []

        await update({ inputs, outputs })
    },
    execute: async ({ step, complete, fail, client }) => {
        try {
            const { inputs } = step;
            const userId = inputs.user.value.replace(/<@|>/g, '')
    
            const openDmResponse = await client.conversations.open({
                users: userId,
                return_im: true
            })

            const channelId = openDmResponse.channel.id;
    
            const postMessageResponse = await client.chat.postMessage({
                channel: channelId,
                text: "Hello!",
                blocks: helpFormGreetingBlocks({ user: userId, isAdvanced: false })
            })

            checkSlackResponseError(postMessageResponse, "An error occurred when posting a direct message")
    
            await complete({})

        } catch (error) {
            console.error(error);
            await fail()
        }
    }
})

app.step(nws)

app.action('show_plato_dialogue', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack()
        // Post 'Talk to Plato' message
        const postRes = await client.chat.postMessage({
            channel: body.channel.id,
            text: "Chat to Plato",
            blocks: helpFormPlatoBlocks({ user: body.user.id, isAdvanced: false })
        })

        checkSlackResponseError(postRes, "An error occurred when posting a 'Chat to Plato' message")

        // Edit button from last message
        const updateRes = await client.chat.update({
            channel: body.channel.id,
            ts: body.message.ts,
            text: 'Hello!',
            blocks: helpFormGreetingBlocks({ user: body.user.id, isAdvanced: true })
        })

        checkSlackResponseError(updateRes, "An error occurred when updating a greeting message")

    } catch (error) {
        console.error(error);
    }
});

app.action('start_help_form', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack()

        // Post Ticket raising form
        const postRes = await client.chat.postMessage({
            channel: body.channel.id,
            text: 'Raise a Ticket With PlatOps',
            blocks: helpFormMainBlocks({ user: body.user.id, isAdvanced: false })
        })

        checkSlackResponseError(postRes, "An error occurred when posting a help request form")

        // Edit button from last message
        const updateRes = await client.chat.update({
            channel: body.channel.id,
            ts: body.message.ts,
            text: 'Chat to Plato',
            blocks: helpFormPlatoBlocks({ user: body.user.id, isAdvanced: true })
        })

        checkSlackResponseError(updateRes, "An error occurred when updating a 'Chat to Plato' message")
    } catch (error) {
        console.error(error);
    }
});

app.action('submit_help_request', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack()

        const user = body.user.id;

        const values = Object.values(body.state.values).reduce(((r, c) => Object.assign(r, c)), {})
        const blocks = body.message.blocks

        // New inputs will be found in our 'values' object if present.
        // If there is a validation problem with the form, it must be re-sent
        // to the user in its entirety and the submitted data will be lost.
        //
        // The only way to keep the data the user entered in the form is to
        // populate the initial_value or initial_option fields of the form when
        // it's sent back. We do this by passing 'helpRequest' to the
        // 'helpRequestRaiseTicketBlocks' function and setting the fields in
        // there.
        //
        // The form can then be re-submitted by the user.
        // If the user did not change a field when re-submitting the form,
        // slack will detect this and will not populate the 'values' object
        // with the value of that field. Instead, we have to read the data from
        // the 'blocks' object we submitted last time. Thankfully this is
        // provided to us.
        
        // Add an explicit check for when the values block exists, but the
        // value === null, this is a special case where the user has deleted
        // what was in the field before submitting and is a distinct case from
        // the block not being present at all. That simply means the user did
        // not update that field before submitting and the field may still
        // have a value in the initial_option block we set.
        const helpRequest = {
            user,
            // Blocks 0 and 1 are labels
            summary:         values.summary     ? values.summary.value               : blocks[2].element.initial_value,
            environment:     values.environment ? values.environment.selected_option : blocks[3].element.initial_option,
            team:            values.team        ? values.team.selected_option        : blocks[4].element.initial_option,
            area:            values.area        ? values.area.selected_option        : blocks[5].element.initial_option,
            prBuildUrl:      values.build_url   ? values.build_url.value             : blocks[6].element.initial_value,
            // Block 7 is a divider
            description:     values.description ? values.description.value           : blocks[8].element.initial_value,
            analysis:        values.analysis    ? values.analysis.value              : blocks[9].element.initial_value,
            checkedWithTeam: values.team_check  ? values.team_check.selected_option  : blocks[10].element.initial_option,
        }

        let errorMessage = null;

        // prBuildUrl and analysis are optional, so don't mandate they be populated
        if (!helpRequest.summary) {
            errorMessage = "Please write a summary for your issue."
        } else if (!helpRequest.environment) {
            errorMessage = "Please specify what environment the issue is occuring in."
        } else if (!helpRequest.team) {
            // TODO: Tell the user how to request a new team be added to the list
            errorMessage = "Please specify the team experiencing the problem."
        } else if (!helpRequest.area) {
            errorMessage = "Please specify what area you're experiencing problems with."
        } else if (!helpRequest.description) {
            errorMessage = "Please provide a description of your issue."
        } else if (!helpRequest.checkedWithTeam) {
            errorMessage = "Please check with your team before submitting a help request."
        }

        //Re-insert current values for text inputs and send the form back
        if (errorMessage != null) {
            const res = await client.chat.update({
                channel: body.channel.id,
                ts: body.message.ts,
                text: "Raise a Ticket With PlatOps",
                blocks: helpFormMainBlocks({
                    user: body.user.id,
                    isAdvanced: false,
                    errorMessage: errorMessage,
                    helpRequest: helpRequest
                })
            })

            checkSlackResponseError(res, "An error occurred when updating an invalid ticket raising form")
            return;
        } else {
            const updateRes = await client.chat.update({
                channel: body.channel.id,
                ts: body.message.ts,
                text: "Raise a Ticket With PlatOps",
                blocks: helpFormMainBlocks({
                    user: body.user.id,
                    isAdvanced: true,
                    errorMessage: errorMessage,
                    helpRequest: helpRequest
                })
            })

            checkSlackResponseError(updateRes, "An error occurred when updating a valid ticket raising form")
        }

        const userEmail = (await client.users.profile.get({
            user
        })).profile.email

        // using JIRA version v8.15.0#815001-sha1:9cd993c:node1,
        // check if API is up-to-date
        const jiraId = await createHelpRequest({
            summary: helpRequest.summary,
            userEmail,
            // Jira labels go here, can't contain spaces btw
            // TODO: Put this in a function?
            // TODO: Add more labels?
            labels: [
                `area-${helpRequest.area.value.toLowerCase().replace(' ', '-')}`,
                `team-${helpRequest.team.value.toLowerCase().replace(' ', '-')}`
            ]
        });

        const mainRes = await client.chat.postMessage({
            channel: reportChannel,
            text: 'New platform help request raised',
            blocks: helpRequestMainBlocks({
                ...helpRequest,
                jiraId
            })
        });

        checkSlackResponseError(mainRes, "An error occurred when posting a help request to Slack")

        const detailsRes = await client.chat.postMessage({
            channel: reportChannel,
            thread_ts: mainRes.message.ts,
            text: 'New platform help request raised',
            blocks: helpRequestDetailBlocks(helpRequest)
        });

        checkSlackResponseError(detailsRes, "An error occurred when posting details of a help request to Slack")

        const permaLink = (await client.chat.getPermalink({
            channel: mainRes.channel,
            'message_ts': mainRes.message.ts
        })).permalink

        await updateHelpRequestDescription(jiraId, {
            ...helpRequest,
            slackLink: permaLink
        });

        const goodbyeRes = await client.chat.postMessage({
            channel: body.channel.id,
            text: 'Help request submitted',
            blocks: helpFormGoodbyeBlocks({
                helpRequestUrl: permaLink
            })
        })

        checkSlackResponseError(goodbyeRes, "An error occurred when posting a goodbye post to Slack")
    } catch (error) {
        console.error("An error occurred when submitting a help form: " + error);
    }
});

// TODO: Break this up into smaller blocks, we're handling every single
// message interaction in this one function.
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
                            blocks: helpRequestDuplicateBlocks({
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

        const userInfo = (await client.users.info({
            user: body.user.id
        }))

        const userEmail = userInfo.user.profile.email

        await assignHelpRequest(jiraId, userEmail)

        const blocks = body.message.blocks
        const assignedToSection = blocks[6]
        assignedToSection.elements[0].initial_user = userInfo.user.enterprise_user.id

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

app.action('resolve_help_request', async ({
    body, action, ack, client, context, payload
}) => {
    try {
        await ack();

        // Trigger IDs have a short lifespan, so process them first
        await client.views.open({
            trigger_id: body.trigger_id,
            view: helpRequestResolveBlocks({ thread_ts: body.message.ts }),
        });

    } catch (error) {
        console.error(error);
    }
});

app.view('document_help_request', async ({ ack, body, view, client }) => {
    try {
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
            category: body.view.state.values.category_block.category.selected_option.value,
            how:      body.view.state.values.how_block.how.value || "N/A",
        };

        await addCommentToHelpRequestResolve(jiraId, documentation)
            
        await addLabel(jiraId, documentation)

        await client.chat.postMessage({
            channel: reportChannel,
            thread_ts: body.view.private_metadata,
            text: 'Platform help request documented',
            blocks: helpRequestDocumentationBlocks(documentation)
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

/////////////////////////////
//// Setup App Homepage  ////
/////////////////////////////
async function appHomeUnassignedIssues(userId, client) {
    const results = await searchForUnassignedOpenIssues()

    const issues = results.issues.slice(0, 20)

    const parsedPromises = issues.flatMap(async result => {
        let reporterUser
        try {
            reporterUser = await client.users.lookupByEmail({
                email: result.fields.reporter.emailAddress
            });
        } catch (error) {
            console.log("Couldn't find user", result.fields.reporter.emailAddress, error)
        }

        return appHomeIssueBlocks({
            summary: result.fields.summary,
            slackLink: extractSlackLinkFromText(result.fields.description),
            jiraId: result.key,
            created: result.fields.created,
            updated: result.fields.updated,
            state: "Open :fire:",
            assignee: null,
            reporter: reporterUser?.user?.enterprise_user?.id
        })
    })
    
    const parsedResults = await Promise.all(parsedPromises);

    await client.views.publish({
        user_id: userId,
        view: {
            type: "home",
            blocks: [
                ...appHomeMainBlocks(),
                ...appHomeHeaderBlocks(
                    'Open Unassigned Help Requests',
                    `Displaying ${issues.length} of ${results.issues.length} results.`
                ),
                ...parsedResults.flat()
            ]
        },
    });
}

app.event('app_home_opened', async ({ event, client }) => {
    await appHomeUnassignedIssues(event.user, client);
});

app.action('view_open_unassigned_requests', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack();
        await appHomeUnassignedIssues(body.user.id, client);
        
    } catch (error) {
        console.error(error);
    }
});

app.action('view_requests_assigned_to_me', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack();

        const user = body.user.id
        const userEmail = (await client.users.profile.get({
            user
        })).profile.email

        const results = await searchForIssuesAssignedTo(userEmail)

        const issues = results.issues.slice(0, 20)
    
        const parsedPromises = issues.flatMap(async result => {
            let reporterUser
            try {
                reporterUser = await client.users.lookupByEmail({
                    email: result.fields.reporter.emailAddress
                });
            } catch (error) {
                console.log("Couldn't find user", result.fields.reporter.emailAddress, error)
            }

            return appHomeIssueBlocks({
                summary: result.fields.summary,
                slackLink: extractSlackLinkFromText(result.fields.description),
                jiraId: result.key,
                created: result.fields.created,
                updated: result.fields.updated,
                state: result.fields.status.name == "Open" ? "Open :fire:" : "In Progress :fire_extinguisher:",
                assignee: body.user.id,
                reporter: reporterUser.user.enterprise_user.id
            })
        })
        
        const parsedResults = await Promise.all(parsedPromises);
    
        await client.views.publish({
            user_id: user,
            view: {
                type: "home",
                blocks: [
                    ...appHomeMainBlocks(),
                    ...appHomeHeaderBlocks(
                        'Help Requests Assigned to You',
                        `Displaying ${issues.length} of ${results.issues.length} results.`
                    ),
                    ...parsedResults.flat()
                ]
            },
        });
        
    } catch (error) {
        console.error(error);
    }
});

app.action('view_requests_raised_by_me', async ({
    body, action, ack, client, context
}) => {
    try {
        await ack();

        const user = body.user.id

        let userEmail
        try {
            userEmail = (await client.users.profile.get({
                user
            })).profile.email;
        } catch (error) {
            console.log("Couldn't find user", body.user.id, error)
        }

        const results = await searchForIssuesRaisedBy(userEmail)
    
        const issues = results.issues.slice(0, 20)
    
        const parsedPromises = issues.flatMap(async result => {
            const assigneeUser = result.fields.assignee === null ? 
                null :
                (await client.users.lookupByEmail({
                    email: result.fields.assignee.emailAddress
                })).user.enterprise_user.id;

            return appHomeIssueBlocks({
                summary: result.fields.summary,
                slackLink: extractSlackLinkFromText(result.fields.description),
                jiraId: result.key,
                created: result.fields.created,
                updated: result.fields.updated,
                state: result.fields.status.name == "Open" ? "Open :fire:" : "In Progress :fire_extinguisher:",
                assignee: assigneeUser,
                reporter: body.user.id
            })
        })
        
        const parsedResults = await Promise.all(parsedPromises);
    
        await client.views.publish({
            user_id: user,
            view: {
                type: "home",
                blocks: [
                    ...appHomeMainBlocks(),
                    ...appHomeHeaderBlocks(
                        'Help Requests Raised by You',
                        `Displaying ${issues.length} of ${results.issues.length} results.`
                    ),
                    ...parsedResults.flat()
                ]
            },
        });
        
    } catch (error) {
        console.error(error);
    }
});
