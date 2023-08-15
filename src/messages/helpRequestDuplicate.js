const { convertJiraKeyToUrl } = require("./util");

function helpRequestDuplicateBlocks({
    summary,
    parentJiraId,
    parentSlackUrl,
    currentIssueJiraId,
}) {
    return [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: summary,
            },
        },
        {
            type: "divider",
        },
        {
            type: "section",
            fields: [
                {
                    type: "mrkdwn",
                    text: `View on Jira: <${convertJiraKeyToUrl(
                        currentIssueJiraId,
                    )}|${currentIssueJiraId}>`,
                },
                {
                    type: "mrkdwn",
                    text: `Duplicate of <${parentSlackUrl}|${parentJiraId}>`,
                },
            ],
        },
    ];
}

module.exports.helpRequestDuplicateBlocks = helpRequestDuplicateBlocks;
