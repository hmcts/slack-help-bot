const JiraApi = require('jira-client');
const config = require('config')
const {createComment, mapFieldsToDescription} = require("./jiraMessages");

const systemUser = config.get('jira.username')

const issueTypeId = config.get('jira.issue_type_id')
const issueTypeName = config.get('jira.issue_type_name')

const jiraProject = config.get('jira.project')

const jiraStartTransitionId = config.get('jira.start_transition_id')
const jiraDoneTransitionId = config.get('jira.done_transition_id')
const extractProjectRegex = new RegExp(`(${jiraProject}-[\\d]+)`)

const jira = new JiraApi({
    protocol: 'https',
    host: 'tools.hmcts.net/jira',
    username: systemUser,
    password: config.get('jira.password'),
    apiVersion: '2',
    strictSSL: true
});

async function resolveHelpRequest(jiraId) {
    try {
        await jira.transitionIssue(jiraId, {
            transition: {
                id: jiraDoneTransitionId
            }
        })
    } catch (err) {
        console.log("Error resolving help request in jira", err)
    }
}

async function startHelpRequest(jiraId) {
    try {
        await jira.transitionIssue(jiraId, {
            transition: {
                id: jiraStartTransitionId
            }
        })
    } catch (err) {
        console.log("Error starting help request in jira", err)
    }
}

async function searchForUnassignedOpenIssues() {
    const jqlQuery = `project = ${jiraProject} AND type = "${issueTypeName}" AND status = Open and assignee is EMPTY ORDER BY created ASC`;
    try {
        return await jira.searchJira(
            jqlQuery,
            {
                // TODO if we moved the slack link out to another field we wouldn't need to request the whole description
                // which would probably be better for performance
                fields: ['created', 'description', 'summary', 'updated']
            }
        )
    } catch (err) {
        console.log("Error searching for issues in jira", err)
        return {
            issues: []
        }
    }
}

async function assignHelpRequest(issueId, email) {
    const user = convertEmail(email)

    try {
        await jira.updateAssignee(issueId, user)
    } catch(err) {
        console.log("Error assigning help request in jira", err)
    }
}

/**
 * Extracts a jira ID
 *
 * expected format: 'View on Jira: <https://tools.hmcts.net/jira/browse/SBOX-61|SBOX-61>'
 * @param blocks
 */
function extractJiraIdFromBlocks(blocks) {
    const viewOnJiraText = blocks[4].elements[0].text // TODO make this less fragile

    return extractProjectRegex.exec(viewOnJiraText)[1]
}

function extraJiraId(text) {
    return extractProjectRegex.exec(text)[1]
}

function convertEmail(email) {
    if (!email) {
        return systemUser
    }

    return email.split('@')[0]
}

async function createHelpRequestInJira(summary, project, user) {
    return await jira.addNewIssue({
        fields: {
            summary: summary,
            issuetype: {
                id: issueTypeId
            },
            project: {
                id: project.id
            },
            labels: ['created-from-slack'],
            description: undefined,
            reporter: {
                name: user // API docs say ID, but our jira version doesn't have that field yet, may need to change in future
            }
        }
    });
}

async function createHelpRequest({
                                     summary,
                                     userEmail
                                 }) {
    const user = convertEmail(userEmail)

    const project = await jira.getProject(jiraProject)

    // https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issues/#api-rest-api-2-issue-post
    // note: fields don't match 100%, our Jira version is a bit old (still a supported LTS though)
    let result
    try {
        result = await createHelpRequestInJira(summary, project, user);
    } catch (err) {
        // in case the user doesn't exist in Jira use the system user
        result = await createHelpRequestInJira(summary, project, systemUser);
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
    } catch (err) {
        console.log("Error creating comment in jira", err)
    }
}

module.exports.resolveHelpRequest = resolveHelpRequest
module.exports.startHelpRequest = startHelpRequest
module.exports.assignHelpRequest = assignHelpRequest
module.exports.createHelpRequest = createHelpRequest
module.exports.updateHelpRequestDescription = updateHelpRequestDescription
module.exports.addCommentToHelpRequest = addCommentToHelpRequest
module.exports.convertEmail = convertEmail
module.exports.extraJiraId = extraJiraId
module.exports.extractJiraIdFromBlocks = extractJiraIdFromBlocks
module.exports.searchForUnassignedOpenIssues = searchForUnassignedOpenIssues
