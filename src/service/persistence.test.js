const jira = require('./persistence')
const config = require('config')

const jiraProject = config.get('jira.project')

describe('convertEmail', () => {
    it('returns null if email is null', () => {
        expect(jira.convertEmail(null)).resolves.toBe(null)
    })
    it('returns null if email is undefined', () => {
        expect(jira.convertEmail(undefined)).resolves.toBe(null)
    })
})

describe('extractJiraId', () => {
    it('extracts the key', () => {
        const expectedKey = `${jiraProject}-61`
        const actual = jira.extractJiraIdFromBlocks([
            {},
            {},
            {},
            {},
            {
                elements: [
                    {
                        text: `View on Jira: <https://hmcts.atlassian.net/browse/${expectedKey}|${expectedKey}>`
                    }
                ]
            }
        ])

        expect(actual).toBe(expectedKey)
    })
})