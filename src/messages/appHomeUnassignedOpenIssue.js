const {
    convertJiraKeyToUrl,
    convertIso8601ToEpochSeconds
} = require('./util')

function appHomeUnassignedOpenIssueBlocks({
    summary,
    slackLink,
    jiraId,
    created,
    updated
}) {
    const link = slackLink ? slackLink : convertJiraKeyToUrl(jiraId)

    return [
        {
            "type": "divider"
        },
        {
            "type": "section",
            "block_id": `${jiraId}_link`,
            "text": {
                "type": "mrkdwn",
                "text": `*<${link}|${summary}>*`
            },
        },
        {
            "type": "actions",
            "block_id": `${jiraId}_actions`,
            "elements": [
                {
                    "type": "users_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Assign to",
                        "emoji": true
                    },
                    "action_id": "app_home_unassigned_user_select"
                },
                {
                    "type": "button",
                    "action_id": "app_home_take_unassigned_issue",
                    "text": {
                        "type": "plain_text",
                        "text": ":raising_hand: Take it"
                    },
                    "style": "primary"
                }
            ]
        },
        {
            "type": "section",
            "block_id": `${jiraId}_fields`,
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": `*:alarm_clock: Opened:*\n <!date^${convertIso8601ToEpochSeconds(created)}^{date_pretty} ({time})|${created}>`
                },
                {
                    "type": "mrkdwn",
                    "text": `*:hourglass: Last Updated:*\n <!date^${convertIso8601ToEpochSeconds(updated)}^{date_pretty} ({time})|${updated}>`
                },
                {
                    "type": "mrkdwn",
                    "text": `*View on Jira*:\n <${convertJiraKeyToUrl(jiraId)}|${jiraId}>`
                }
            ]
        },
    ]
}

module.exports.appHomeUnassignedOpenIssueBlocks = appHomeUnassignedOpenIssueBlocks