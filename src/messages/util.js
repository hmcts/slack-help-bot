function convertIso8601ToEpochSeconds(isoTime) {
  if (isoTime === undefined) {
    return undefined;
  }

  return Date.parse(isoTime) / 1000;
}

function convertStoragePathToHmctsWayUrl(storagePath) {
  const url = new URL(storagePath);

  return url.pathname
    .replace("/the-hmcts-way/build", "https://hmcts.github.io")
    .replace("/the-hmcts-way", "https://hmcts.github.io");
}

function convertHighlightToSlackMarkup(highlight) {
  // Azure AI search likes to put its <em> tags quite randomly in places which don't work for Slack markup
  // So we process and clean it up to make it work
  return (
    highlight
      // ensure there is a space before the <em> tag
      .replace(/(\w)(<em>)/g, "$1 <em>")
      // ensure there is no space after the <em> tag
      .replace(/<em> /g, "<em>")
      // ensure there is no space before the </em> tag
      .replace(/ <\/em>/g, "</em>")
      // convert <em> to slack code block
      .replace(/<em>/g, "`")
      // convert </em> to slack code block
      .replace(/<\/em>/g, "`")
  );
}

function extractKnowledgeStoreHighlight(item) {
  if (item.captions && item.captions.length > 0) {
    return (
      convertHighlightToSlackMarkup(item.captions[0].highlights) ||
      " "
    );
  }
  return item.document.content.slice(0, 100);
}

function convertJiraKeyToUrl(jiraId) {
  return `https://tools.hmcts.net/jira/browse/${jiraId}`;
}

const slackMessageIdRegex = /.*slack\.com\/archives\/[a-zA-Z0-9]{11}\/(.*)\|/;
const slackLinkRegex = /view in Slack\|(https:\/\/.+slack\.com.+)]/;

function extractSlackMessageIdFromText(text) {
  if (text === undefined) {
    return undefined;
  }

  const regexResult = slackMessageIdRegex.exec(text);
  if (regexResult === null) {
    return undefined;
  }
  return regexResult[1];
}

function extractSlackLinkFromText(text) {
  if (text === undefined) {
    return undefined;
  }

  const regexResult = slackLinkRegex.exec(text);
  if (regexResult === null) {
    return undefined;
  }
  return regexResult[1];
}

function stringTrim(string, maxLength, truncationMessage) {
  if (string.length >= maxLength) {
    return string
      .slice(0, maxLength - truncationMessage.length)
      .concat(truncationMessage);
  } else {
    return string;
  }
}

// Generates a block suitable for use in the "options" field of a static_select
function optionBlock(name, option) {
  return {
    text: {
      type: "plain_text",
      text: name,
      emoji: true,
    },
    value: option ?? name.toLowerCase(),
  };
}

module.exports.convertIso8601ToEpochSeconds = convertIso8601ToEpochSeconds;
module.exports.convertJiraKeyToUrl = convertJiraKeyToUrl;
module.exports.extractSlackMessageIdFromText = extractSlackMessageIdFromText;
module.exports.extractSlackLinkFromText = extractSlackLinkFromText;
module.exports.stringTrim = stringTrim;
module.exports.optionBlock = optionBlock;
module.exports.convertStoragePathToHmctsWayUrl =
  convertStoragePathToHmctsWayUrl;
module.exports.extractKnowledgeStoreHighlight = extractKnowledgeStoreHighlight;
