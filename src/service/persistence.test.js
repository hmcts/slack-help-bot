const jira = require('./persistence')

const systemUser = process.env.JIRA_USERNAME || 'mock-system-user'
const jiraProject = process.env.JIRA_PROJECT || 'SBOX'

describe('integration tests', () => {
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

    test('issue is resolved', async () => {
        await jira.resolveHelpRequest('SBOX-51')
    });
})

describe('convertEmail', () => {
    it('strips email', () => {
        expect(jira.convertEmail('bobs.uncle@hmcts.net')).toBe('bobs.uncle')
    })
    it('returns system email if null', () => {
        expect(jira.convertEmail(null)).toBe(systemUser)
    })
    it('returns system email if undefined', () => {
        expect(jira.convertEmail(null)).toBe(systemUser)
    })
    it('returns username if no @ sign in email', () => {
        expect(jira.convertEmail('bobs.uncle')).toBe('bobs.uncle')
    })
})

describe('extractJiraId', () => {
    it('extracts the key', () => {
        const actual = jira.extractJiraId('View on Jira: <https://tools.hmcts.net/jira/browse/SBOX-61|SBOX-61>')

        expect(actual).toBe('SBOX-61')
    })
})
