function optionalField(prefix, value) {
    if (value) {
        return `*${prefix}*: ${value}`
    }
    return ""
}

function mapFieldsToDescription(
    {
        replicateSteps,
        references,
        ccdReferences,
        rcReferences,
        testAccount,
        environment,
        description,
        analysis,
        slackLink
    }) {
    return `
h6. _This is an automatically generated ticket created from Slack, do not reply or update in here, [view in Slack|${slackLink}]_

${optionalField('SNow/Jira References', references)}

${optionalField('CCD Case References', ccdReferences)}

${optionalField('RC References', rcReferences)}

${optionalField('Environment', environment)}

*Issue description*

${description}

*Steps to replicate*

${replicateSteps}

*Test Account*: ${testAccount}

*Analysis done so far*: 
${analysis}

`
}

function createComment({slackLink, name, message}) {
return `
h6. _This is an automatically added comment created from Slack, do not reply or update in here, [view in Slack|${slackLink}]_

h6. ${name}:
${message}
`
}

function createResolveComment({what, where, how}) {
return `
h6. _Ticket resolved - see documented resolution:_

h6. Issue type: 
${what}

h6. Where the issue was:
${where}

h6. How it was resolved: 
${how}
`
}

module.exports.mapFieldsToDescription = mapFieldsToDescription
module.exports.createComment = createComment
module.exports.createResolveComment = createResolveComment
