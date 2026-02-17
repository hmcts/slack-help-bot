function optionalField(prefix, value) {
  if (value) {
    return `*${prefix}*: ${value}`;
  }
  return "";
}

function formatFollowUpAnswers(followUpAnswers) {
  if (!Array.isArray(followUpAnswers) || followUpAnswers.length === 0) {
    return "";
  }

  const lines = followUpAnswers
    .filter((item) => item && item.question && item.answer)
    .map((item) => `*${item.question}*\n${item.answer}`)
    .join("\n\n");

  if (!lines) {
    return "";
  }

  return `
*AI follow-up answers*

${lines}
`;
}

function mapFieldsToDescription({
  prBuildUrl,
  environment,
  description,
  analysis,
  followUpAnswers,
  checkedWithTeam,
  slackLink,
}) {
  return `
h6. _This is an automatically generated ticket created from Slack, do not reply or update in here, [view in Slack|${slackLink}]_

${optionalField("PR / build URLs", prBuildUrl)}


${optionalField("Environment", environment.text.text)}

*Issue description*

${description}

*Analysis done so far*: ${analysis ?? "None"}

${formatFollowUpAnswers(followUpAnswers)}
`;
}

function createComment({ slackLink, name, message }) {
  return `
h6. _This is an automatically added comment created from Slack, do not reply or update in here, [view in Slack|${slackLink}]_

h6. ${name}:
${message}
`;
}

function createResolveComment({ category, how }) {
  return `
h6. _Ticket resolved - see documented resolution:_

h6. Issue type: 
${category}

h6. How it was resolved: 
${how}
`;
}

module.exports.mapFieldsToDescription = mapFieldsToDescription;
module.exports.createComment = createComment;
module.exports.createResolveComment = createResolveComment;
