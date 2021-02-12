const messages = require('./messages')

describe('extractSlackLinkFromText', () => {
    it('returns undefined when undefined', () => {
        expect(messages.extractSlackLinkFromText(undefined)).toBe(undefined)
    })
    it('returns undefined when no match', () => {
        expect(messages.extractSlackLinkFromText("hello world")).toBe(undefined)
    })
    it('returns slack message link when found', () => {
        expect(messages.extractSlackLinkFromText("h6. _This is an automatically generated ticket created from Slack, do not reply or update in here, [view in Slack|https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611568116006500]_"))
            .toBe('https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611568116006500')
    })
})

describe('extractSlackMessageIdFromText', () => {
    it('returns undefined when undefined', () => {
        expect(messages.extractSlackMessageIdFromText(undefined)).toBe(undefined)
    })
    it('returns undefined when no match', () => {
        expect(messages.extractSlackMessageIdFromText("hello world")).toBe(undefined)
    })
    it('returns slack message id when found', () => {
        expect(messages.extractSlackMessageIdFromText("*<https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611568116006500|Dummy>*\n"))
            .toBe('p1611568116006500')
    })
})
