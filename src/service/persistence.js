const JiraApi = require('jira-client');
const config = require('config')
const {createComment, mapFieldsToDescription} = require("./jiraMessages");

const systemUser = config.get('jira.username')

const issueTypeId = config.get('jira.issue_type_id')

const jiraProject = config.get('jira.project')

const jiraStartTransitionId = config.get('jira.start_transition_id')
const jiraDoneTransitionId = config.get('jira.done_transition_id')
const extractProjectRegex = new RegExp('browse/(' + jiraProject + '-[\\d]+)')

const jira = new JiraApi({
    protocol: 'https',
    host: 'tools.hmcts.net/jira',
    username: systemUser,
    password: config.get('jira.password'),
    apiVersion: '2',
    strictSSL: true
});

async function resolveHelpRequest(jiraId) {
    await jira.transitionIssue(jiraId, {
        transition: {
            id: jiraDoneTransitionId
        }
    })
}

async function startHelpRequest(jiraId) {
    await jira.transitionIssue(jiraId, {
        transition: {
            id: jiraStartTransitionId
        }
    })
}

async function reopenHelpRequest() {

}

async function assignHelpRequest(issueId, email) {
    const user = convertEmail(email)

    await jira.updateAssignee(issueId, user)
}

/**
 * Extracts a jira ID
 *
 * expected format: 'View on Jira: <https://tools.hmcts.net/jira/browse/SBOX-61|SBOX-61>'
 * @param blocks
 */
function extractJiraId(blocks) {
    const viewOnJiraText = blocks[4].elements[0].text // TODO make this less fragile

    return extractProjectRegex.exec(viewOnJiraText)[1]
}

function convertEmail(email) {
    if (!email) {
        return systemUser
    }

    return email.split('@')[0]
}

async function createHelpRequestInJira(summary, project, user) {
    const result = await jira.addNewIssue({
        fields: {
            summary: summary,
            issuetype: {
                id: issueTypeId
            },
            project: {
                id: project.id
            },
            description: undefined,
            reporter: {
                name: user // API docs say ID, but our jira version doesn't have that field yet, may need to change in future
            },
            priority: {
                id: "4" // Medium
            }
        }
    })
    return result;
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
    await jira.updateIssue(issueId, {
        update: {
            description: [{
                set: jiraDescription
            }]
        }
    })
}

async function addCommentToHelpRequest(externalSystemId, fields) {
    await jira.addComment(externalSystemId, createComment(fields))
}

module.exports.resolveHelpRequest = resolveHelpRequest
module.exports.startHelpRequest = startHelpRequest
module.exports.reopenHelpRequest = reopenHelpRequest
module.exports.assignHelpRequest = assignHelpRequest
module.exports.createHelpRequest = createHelpRequest
module.exports.updateHelpRequestDescription = updateHelpRequestDescription
module.exports.addCommentToHelpRequest = addCommentToHelpRequest
module.exports.convertEmail = convertEmail
module.exports.extractJiraId = extractJiraId
