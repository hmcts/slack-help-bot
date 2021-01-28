const messages = require('./messages')

describe('extractSlackLinkFromText', () => {
    it('returns undefined when undefined', () => {
        expect(messages.extractSlackLinkFromText(undefined)).toBe(undefined)
    })
    it('returns undefined when no match', () => {
        expect(messages.extractSlackLinkFromText("hello world")).toBe(undefined)
    })
    it('returns slack message id when found', () => {
        expect(messages.extractSlackLinkFromText("h6. _This is an automatically generated ticket created from Slack, do not reply or update in here, [view in Slack|https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611568116006500]_"))
            .toBe('https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611568116006500')
    })

})
