function appHomeMainBlocks(openIssueBlocks) {
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Open unassigned issues*"
            }
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Unassigned open issues",
                        "emoji": true
                    },
                    "value": "unassigned_open_issues",
                    "action_id": "unassigned_open_issues"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "My issues",
                        "emoji": true
                    },
                    "value": "my_issues",
                    "action_id": "my_issues"
                }
            ]
        },
        ...openIssueBlocks
    ]
}

module.exports.appHomeMainBlocks = appHomeMainBlocks