const JiraApi = require('jira-client');
const config = require('config')
const {createComment, mapFieldsToDescription, createResolveComment} = require("./jiraMessages");

const issueTypeId = config.get('jira.issue_type_id')
const issueTypeName = config.get('jira.issue_type_name')

const jiraProject = config.get('jira.project')

const jiraStartTransitionId = config.get('jira.start_transition_id')
const jiraDoneTransitionId = config.get('jira.done_transition_id')
const extractProjectRegex = new RegExp(`(${jiraProject}-[\\d]+)`)

const DONE_TRANSITION_NAMES = ['Done', 'Resolve Issue', 'Resolved', 'Close Issue', 'Closed']
const START_TRANSITION_NAMES = ['Start Progress', 'In Progress', 'Start']

const jiraApiUrl = new URL(config.get('jira.api_url'));
if (config.has('jira.cloud_id')) {
  jiraApiUrl.pathname = `${jiraApiUrl.pathname.replace(/\/+$/, '')}/${config.get('jira.cloud_id')}`;
}

const jira = new JiraApi({
  protocol: jiraApiUrl.protocol.replace(':', ''),
  host: jiraApiUrl.hostname,
  port: jiraApiUrl.port,
  base: jiraApiUrl.pathname.replace(/\/+$/, ''),
  username: config.get('jira.username'),
  password: config.get('jira.api_token'),
  apiVersion: '2',
  strictSSL: true,
});

function normaliseName(name) {
    return (name || '').trim().toLowerCase()
}

async function transitionIssueSafely(issueId, preferredTransitionId, fallbackTransitionNames) {
    const transitionsResponse = await jira.listTransitions(issueId)
    const availableTransitions = transitionsResponse.transitions || []

    const preferred = availableTransitions.find((transition) => String(transition.id) === String(preferredTransitionId))
    const byName = availableTransitions.find((transition) =>
        fallbackTransitionNames.map(normaliseName).includes(normaliseName(transition.name))
    )

    const selectedTransition = preferred || byName
    if (!selectedTransition) {
        console.log(
            `No valid transition found for issue ${issueId}. ` +
            `Configured transition id: ${preferredTransitionId}. ` +
            `Available transitions: ${availableTransitions.map((t) => `${t.id}:${t.name}`).join(', ')}`
        )
        return false
    }

    await jira.transitionIssue(issueId, {
        transition: {
            id: selectedTransition.id
        }
    })

    return true
}

async function resolveHelpRequest(jiraId) {
    try {
        await transitionIssueSafely(jiraId, jiraDoneTransitionId, DONE_TRANSITION_NAMES)
    } catch (err) {
        console.log("Error resolving help request in jira", err)
    }
}

async function markAsDuplicate(jiraIdToUpdate, parentJiraId) {
    try {
        await jira.issueLink({
            type: {
                name: "Duplicate"
            },
            inwardIssue: {
                key: jiraIdToUpdate
            },
            outwardIssue: {
                key: parentJiraId
            },
        });

        await transitionIssueSafely(jiraIdToUpdate, jiraDoneTransitionId, DONE_TRANSITION_NAMES)
    } catch (err) {
        console.log("Error marking help request as duplicate in jira", err)
    }
}


async function startHelpRequest(jiraId) {
    try {
        await transitionIssueSafely(jiraId, jiraStartTransitionId, START_TRANSITION_NAMES)
    } catch (err) {
        console.log("Error starting help request in jira", err)
    }
}

function isIssueNotFound(err) {
    const message = (err && (err.message || err)) + ''
    return /does not exist|not find|not found/i.test(message)
}

async function getIssueDescription(issueId) {
    try {
        const uri = jira.makeUri({
            pathname: `/issue/${issueId}`,
            query: { fields: 'description' }
        });
        const issue = await jira.doRequest(jira.makeRequestHeader(uri));
        const description = issue && issue.fields && issue.fields.description;
        return description;
    } catch (err) {
        if (isIssueNotFound(err)) {
            return undefined;
        } else {
            throw err
        }

    }
}

async function searchForUnassignedOpenIssues() {
    const jqlQuery = `project = ${jiraProject} AND type = "${issueTypeName}" AND status = Open and assignee is EMPTY AND labels not in ("Heritage") ORDER BY created ASC`;
    try {
        const uri = jira.makeUri({ pathname: '/search' });
        const results = await jira.doRequest(jira.makeRequestHeader(uri, {
            method: 'POST',
            body: {
                jql: jqlQuery,
                fields: ['created', 'description', 'summary', 'updated']
            }
        }))

        const issues = (results.issues || []).map((issue) => ({
            ...issue,
            fields: {
                ...issue.fields,
                description: issue.fields && issue.fields.description
            }
        }))

        return {
            issues
        }
    } catch (err) {
        console.log("Error searching for issues in jira", err)
        return {
            issues: []
        }
    }
}

async function assignHelpRequest(issueId, email) {
    let accountId = await convertEmail(email)

    if (!accountId) {
        console.log(`Could not find Jira account for email ${email}, attempting to assign the system user`)
        accountId = await getSystemAccountId()
    }

    if (!accountId) {
        console.log(`Could not resolve system user account for ${config.get('jira.username')}`)
        return
    }

    try {
        await jira.updateAssigneeWithId(issueId, accountId)
    } catch(err) {
        console.log("Error assigning help request in jira", err)
    }
}

/**
 * Extracts a jira ID
 *
 * expected format: 'View on Jira: <https://hmcts.atlassian.net/browse/SBOX-61|SBOX-61>'
 * @param blocks
 */
function extractJiraIdFromBlocks(blocks) {
    if (!Array.isArray(blocks)) {
        return 'undefined'
    }

    const textFragments = []
    for (const block of blocks) {
        if (block?.text?.text) {
            textFragments.push(block.text.text)
        }
        if (Array.isArray(block?.fields)) {
            for (const field of block.fields) {
                if (field?.text) {
                    textFragments.push(field.text)
                }
            }
        }
        if (Array.isArray(block?.elements)) {
            for (const element of block.elements) {
                if (element?.text) {
                    textFragments.push(element.text)
                }
            }
        }
    }

    const jiraText = textFragments.join(' ')
    const project = extractProjectRegex.exec(jiraText)
    return project ? project[1] : 'undefined'
}

function extraJiraId(text) {
    return extractProjectRegex.exec(text)[1]
}

let cachedSystemAccountId
let systemAccountIdPromise

async function getSystemAccountId() {
    if (cachedSystemAccountId) {
        return cachedSystemAccountId
    }

    if (!systemAccountIdPromise) {
        systemAccountIdPromise = jira.getCurrentUser()
            .then(user => {
                cachedSystemAccountId = user && user.accountId
                return cachedSystemAccountId
            })
            .catch(err => {
                console.log("Unable to resolve Jira system account", err)
                return undefined
            })
    }

    return systemAccountIdPromise
}

async function convertEmail(email) {
    if (!email) {
        return null
    }

    try {
        const res = await jira.searchUsers({
            query: email,
            maxResults: 1
        })

        if (res && res.length > 0 && (res[0].accountId || res[0].name)) {
            return res[0].accountId || res[0].name
        }

        console.log(`No Jira user found for email: ${email}`)
        return getSystemAccountId()
    } catch(ex) {
        console.log("Querying username failed: " + ex)
        return getSystemAccountId()
    }
}

async function createHelpRequestInJira(summary, project, reporterAccountId, includeCustomField, labels) {
    console.log(`Creating help request in Jira for reporter account: ${reporterAccountId}`)

    const fields = {
        summary: summary,
        issuetype: {
            id: issueTypeId
        },
        project: {
            id: project.id
        },
        labels: ['F&PPETTeam', 'created-from-slack', ...labels],
        description: undefined,
        fixVersions: [ { name: "F&P No Release Required" } ] // TODO Make this configurable
    };

    // reporter defaults to the authenticated user if not provided
    if (reporterAccountId) {
        fields.reporter = {
            accountId: reporterAccountId
        };
    }

    if (includeCustomField) {
        fields.customfield_10008 = 'PAY-6381'; // TODO: Probably make configurable
    }

    const issue = await jira.addNewIssue({ fields });

    try {
        await jira.transitionIssue(issue.key, {
            transition: {
                id: "481" // Move to "Awaiting Initial Triage"
            }
        })
    } catch (err) {
        console.log("Unable to transition new issue to 'Awaiting Initial Triage'", err)

        try {
            const transitionsResponse = await jira.listTransitions(issue.key)
            const availableTransitions = transitionsResponse.transitions || []
            console.log("Available transitions:", availableTransitions.map(t => `${t.id}:${t.name}`).join(', '))
        } catch (listErr) {
            console.log("Could not list transitions", listErr)
        }
    }

    return issue;
}

async function createHelpRequest({
                                     summary,
                                     userEmail,
                                     labels
                                 }) {
    const reporterAccountId = await convertEmail(userEmail)

    const project = await jira.getProject(jiraProject);

    // https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issues/#api-rest-api-2-issue-post
    // note: fields don't match 100%, our Jira version is a bit old (still a supported LTS though)

    let result
    try {
        // customfield_10008 may not exist (or may have a different id) in the cloud instance,
        // so fall back to creating without it
        result = await createHelpRequestInJira(summary, project, reporterAccountId, true, labels);
    } catch (err) {
        console.log("Error creating issue with customfield_10008, retrying without it", err)

        try {
            result = await createHelpRequestInJira(summary, project, reporterAccountId, false, labels);
        } catch (err2) {
            // in case the reporter doesn't exist in Jira, create without a reporter so it defaults to the system user
            console.log("Error creating help request, falling back to default reporter (system user)", err2)
            result = await createHelpRequestInJira(summary, project, null, false, labels);
        }
    }

    if (!result.key) {
        console.log("Error creating help request in jira", JSON.stringify(result));
    }

    return result.key
}

async function updateHelpRequestDescription(issueId, fields) {
    const jiraDescription = mapFieldsToDescription(fields);
    try {
        await jira.updateIssue(issueId, {
            update: {
                description: [{
                    set: jiraDescription
                }]
            }
        })
    } catch(err) {
        console.log("Error updating help request description in jira", err)
    }
}

async function addCommentToHelpRequest(externalSystemId, fields) {
    try {
        await jira.addComment(externalSystemId, createComment(fields))
        console.log(`Added Jira comment to issue ${externalSystemId}`)
    } catch (err) {
        console.log(`Error creating comment in jira for issue ${externalSystemId}`, {
            error: err,
            fields
        })
    }
}

async function addCommentToHelpRequestResolve(externalSystemId, { what, where, how} ) {
    try {
        await jira.addComment(externalSystemId, createResolveComment({what, where, how}))
    } catch (err) {
        console.log("Error creating comment in jira", err)
    }
}

async function addLabel(externalSystemId, { category} ) {
    try {
        await jira.updateIssue(externalSystemId, {
            update: {
                labels: [{
                    add: `resolution-${category.toLowerCase().replaceAll(' ', '-')}`
                }]
            }
        })
    } catch(err) {
        console.log("Error updating help request description in jira", err)
    }
}


module.exports.resolveHelpRequest = resolveHelpRequest
module.exports.startHelpRequest = startHelpRequest
module.exports.assignHelpRequest = assignHelpRequest
module.exports.createHelpRequest = createHelpRequest
module.exports.updateHelpRequestDescription = updateHelpRequestDescription
module.exports.addCommentToHelpRequest = addCommentToHelpRequest
module.exports.addCommentToHelpRequestResolve = addCommentToHelpRequestResolve
module.exports.addLabel = addLabel
module.exports.convertEmail = convertEmail
module.exports.extraJiraId = extraJiraId
module.exports.extractJiraIdFromBlocks = extractJiraIdFromBlocks
module.exports.searchForUnassignedOpenIssues = searchForUnassignedOpenIssues
module.exports.getIssueDescription = getIssueDescription
module.exports.markAsDuplicate = markAsDuplicate
