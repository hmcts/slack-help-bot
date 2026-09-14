const {wikiToAdf, adfToText} = require('./adf')

const slackLink = 'https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611568116006500'

describe('wikiToAdf', () => {
    it('converts an h6 heading', () => {
        const adf = wikiToAdf('h6. Hello world')

        expect(adf).toEqual({
            version: 1,
            type: 'doc',
            content: [{
                type: 'heading',
                attrs: {level: 6},
                content: [{type: 'text', text: 'Hello world'}]
            }]
        })
    })

    it('converts a bold label and plain text in the same paragraph', () => {
        const adf = wikiToAdf('*Test Account*: user')

        expect(adf.content).toEqual([{
            type: 'paragraph',
            content: [
                {type: 'text', text: 'Test Account', marks: [{type: 'strong'}]},
                {type: 'text', text: ': user'}
            ]
        }])
    })

    it('converts italic text wrapping a slack link', () => {
        const adf = wikiToAdf(`h6. _This is an automatically generated ticket created from Slack, do not reply or update in here, [view in Slack|${slackLink}]_`)

        expect(adf.content).toEqual([{
            type: 'heading',
            attrs: {level: 6},
            content: [{
                type: 'text',
                text: 'This is an automatically generated ticket created from Slack, do not reply or update in here, ',
                marks: [{type: 'em'}]
            }, {
                type: 'text',
                text: 'view in Slack',
                marks: [
                    {type: 'em'},
                    {type: 'link', attrs: {href: slackLink}}
                ]
            }]
        }])
    })

    it('separates blank-line-delimited blocks', () => {
        const adf = wikiToAdf('first paragraph\n\nsecond paragraph')

        expect(adf.content.map((block) => block.type)).toEqual(['paragraph', 'paragraph'])
        expect(adfToText(adf)).toBe('first paragraph\nsecond paragraph')
    })

    it('splits multi-line user content into paragraphs', () => {
        const adf = wikiToAdf('*Issue description*\n\nline one\nline two')

        expect(adf.content.map((block) => block.type)).toEqual(['paragraph', 'paragraph', 'paragraph'])
    })

    it('drops empty optional fields', () => {
        const adf = wikiToAdf(`
h6. _This is an automatically generated ticket created from Slack, do not reply or update in here, [view in Slack|${slackLink}]_

*Issue description*

details
`)

        expect(adf.content.map((block) => block.type)).toEqual(['heading', 'paragraph', 'paragraph'])
    })
})

describe('adfToText', () => {
    it('returns empty string for null/undefined', () => {
        expect(adfToText(null)).toBe('')
        expect(adfToText(undefined)).toBe('')
    })

    it('passes plain strings through', () => {
        expect(adfToText('plain text')).toBe('plain text')
    })

    it('round-trips the automatically generated ticket header so the slack link is extractable', () => {
        const wiki = `h6. _This is an automatically generated ticket created from Slack, do not reply or update in here, [view in Slack|${slackLink}]_`
        const text = adfToText(wikiToAdf(wiki))

        expect(text).toContain(`view in Slack|${slackLink}]`)
    })

    it('renders marks back to wiki markup', () => {
        const adf = wikiToAdf('*bold* and _italic_ text')
        const text = adfToText(adf)

        expect(text).toBe('*bold* and _italic_ text')
    })
})

describe('round-trip with mapFieldsToDescription', () => {
    const {mapFieldsToDescription} = require('./jiraMessages')

    it('preserves the slack link through a full convert', () => {
        const wiki = mapFieldsToDescription({
            replicateSteps: 'step one\nstep two',
            references: 'SBOX-100',
            ccdReferences: '',
            rcReferences: '',
            testAccount: 'user',
            environment: 'Production',
            description: 'A description',
            analysis: 'Found it',
            slackLink
        })

        const text = adfToText(wikiToAdf(wiki))

        expect(text).toContain(`[view in Slack|${slackLink}]`)
        expect(text).toContain('step one')
        expect(text).toContain('step two')
    })
})