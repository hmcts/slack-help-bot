function convertIso8601ToEpochSeconds(isoTime) {
	if (isoTime === undefined) {
		return undefined;
	}

	return Date.parse(isoTime) / 1000;
}

function convertJiraKeyToUrl(jiraId) {
	return `https://tools.hmcts.net/jira/browse/${jiraId}`;
}

const config = require("config");

const slackChannelId = config.get("slack.report_channel_id");
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
