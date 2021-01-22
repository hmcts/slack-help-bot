const JiraApi = require('jira-client');
const {mapFieldsToDescription} = require("./jiraMessages");

const systemUser = process.env.JIRA_USERNAME || 'mock-system-user'

// you can find the type with a GET on the project via rest api
const issueTypeId = process.env.JIRA_ISSUE_TYPE || '10900' // TODO remove default

const jiraProject = process.env.JIRA_PROJECT || 'SBOX' // TODO remove default
const extractProjectRegex = new RegExp('browse/(' + jiraProject + '-[\\d]+)')

const jira = new JiraApi({
    protocol: 'https',
    host: 'tools.hmcts.net/jira',
    username: systemUser,
    password: process.env.JIRA_PASSWORD,
    apiVersion: '2',
    strictSSL: true
});

async function resolveHelpRequest() {

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
 * @param viewOnJiraText
 */
function extractJiraId(viewOnJiraText) {
    return extractProjectRegex.exec(viewOnJiraText)[1]
}

function convertEmail(email) {
    if (!email) {
        return systemUser
    }

    return email.split('@')[0]
}

async function createHelpRequest({
                                     summary,
                                     userEmail
                                 }) {
    const user = convertEmail(userEmail)

    const project = await jira.getProject(jiraProject)

    // https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issues/#api-rest-api-2-issue-post
    // note: fields don't match 100%, our Jira version is a bit old (still a supported LTS though)
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

async function addCommentToHelpRequest(externalSystemId, comment) {

}

module.exports.resolveHelpRequest = resolveHelpRequest
module.exports.reopenHelpRequest = reopenHelpRequest
module.exports.assignHelpRequest = assignHelpRequest
module.exports.createHelpRequest = createHelpRequest
module.exports.updateHelpRequestDescription = updateHelpRequestDescription
module.exports.addCommentToHelpRequest = addCommentToHelpRequest
module.exports.convertEmail = convertEmail
module.exports.extractJiraId = extractJiraId
