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
        testAccount,
        environment,
        description,
        analysis,
        slackLink
    }) {
    return `
h6. _This is an automatically generated ticket created from Slack, do not reply or update in here, [view in Slack|${slackLink}]_

${optionalField('SNOW/JIRA References', references)}

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

module.exports.mapFieldsToDescription = mapFieldsToDescription
module.exports.createComment = createComment
