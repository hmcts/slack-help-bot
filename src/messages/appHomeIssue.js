const {
    convertJiraKeyToUrl,
    convertIso8601ToEpochSeconds
} = require('./util')

function appHomeIssueBlocks({
    summary,
    slackLink,
    jiraId,
    created,
    updated,
    state,
    assignee,
    reporter
}) {
    const link = slackLink ? slackLink : convertJiraKeyToUrl(jiraId)

    return [
        {
            "type": "section",
            "block_id": `${jiraId}_link`,
            "text": {
                "type": "mrkdwn",
                "text": `*<${link}|${summary}>*`
            },
        },
        {
            "type": "section",
            "block_id": `${jiraId}_assignee`,
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": !assignee ?
                        `*Assigned to :bust_in_silhouette:*\n Unassigned` :
                        `*Assigned to :bust_in_silhouette:*\n <@${assignee}>`
                },
                {
                    "type": "mrkdwn",
                    "text": !reporter ?
                    `*Raised by :man-surfing:*\n Unknown User` :
                        `*Raised by :man-surfing:*\n <@${reporter}>`
                },
            ]
        },
        {
            "type": "section",
            "block_id": `${jiraId}_fields`,
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": `*${state}*`
                },
                {
                    "type": "mrkdwn",
                    "text": `*Opened :alarm_clock:*\n <!date^${convertIso8601ToEpochSeconds(created)}^{date_pretty} ({time})|${created}>`
                },
                {
                    "type": "mrkdwn",
                    "text": `*View on Jira :link:*\n <${convertJiraKeyToUrl(jiraId)}|${jiraId}>`
                },
                {
                    "type": "mrkdwn",
                    "text": `*Last Updated :hourglass:*\n <!date^${convertIso8601ToEpochSeconds(updated)}^{date_pretty} ({time})|${updated}>`
                },
            ]
        },
        {
            "type": "divider"
        }
    ]
}

module.exports.appHomeIssueBlocks = appHomeIssueBlocks