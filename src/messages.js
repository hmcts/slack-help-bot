function helpRequestRaised(user, summary, environment, assignedTo, jiraId) {
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `New platform help request raised by <@${user}>`
            }
        },
        {
            "type": "divider"
        },
        {
            "type": "section",
            "text": {
                "type": "plain_text",
                "text": `:warning: Summary: ${summary}`,
                "emoji": true
            }
        },
        {
            "type": "section",
            "text": {
                "type": "plain_text",
                "text": `:house: Environment: ${environment}`,
                "emoji": true
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ":mechanic: Assigned to: "
            },
            "accessory": {
                "type": "users_select",
                "placeholder": {
                    "type": "plain_text",
                    "text": "Unassigned",
                    "emoji": true
                },
                "action_id": "assign_help_request_to_user"
            }
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": `View on Jira: <https://tools.hmcts.net/jira/browse/${jiraId}|${jiraId}>`
                }
            ]
        },
        {
            "type": "divider"
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": ":eyes: Take it",
                        "emoji": true
                    },
                    "value": "assign_help_request_to_me",
                    "action_id": "assign_help_request_to_me"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": " :white_check_mark: Resolve",
                        "emoji": true
                    },
                    "value": "resolve_help_request",
                    "action_id": "resolve_help_request"
                }
            ]
        },
        {
            "type": "divider"
        }
    ]
}

module.exports.helpRequestRaised = helpRequestRaised