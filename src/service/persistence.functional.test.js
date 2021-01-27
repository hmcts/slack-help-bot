const jira = require('./persistence');
const config = require('config')

const jiraProject = config.get('jira.project');

// TODO figure out best way to have 'functional' tests separate in jest
describe('functional tests', () => {
    test('help request is created', async () => {
        const helpRequest = {
            summary: "Test creation of issue",
            prBuildUrl: undefined,
            environment: "Production",
            description: "Big large error message, something bad happened",
            analysis: "Service principal expired",
            checkedWithTeam: "Yes",
            userEmail: "tim.jacomb@hmcts.net"
        }

        const issueKey = await jira.createHelpRequest(helpRequest)
        expect(issueKey).toStartWith(`${jiraProject}-`)
        console.log(issueKey)
    });
    test('help request description is updated', async() => {
        const helpRequest = {
            summary: "Test creation of issue",
            prBuildUrl: undefined,
            environment: "Production",
            description: "Big large error message, something bad happened",
            analysis: "Service principal expired",
            checkedWithTeam: "Yes",
            slackLink: "https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611272568001500"
        }

        await jira.updateHelpRequestDescription('SBOX-51', helpRequest)
    })

    test('issue is assigned to user', async ()=> {
        await jira.assignHelpRequest('SBOX-51', 'tim.jacomb')
    })

    test('comment is added to help request', async () => {
        await jira.addCommentToHelpRequest('SBOX-58', {
            slackLink: 'https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611324186001500',
            displayName: 'Alice',
            message: 'Can anyone help?'
        })
    });

    test('issue is in progress', async () => {
        await jira.startHelpRequest('SBOX-51')
    });

    test('issue is resolved', async () => {
        await jira.resolveHelpRequest('SBOX-51')
    });
})
