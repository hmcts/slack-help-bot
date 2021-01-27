function helpRequestRaised({
                               user,
                               summary,
                               environment,
                               prBuildUrl,
                               jiraId
                           }) {
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `*${summary}*`,
            }
        },
        {
            "type": "divider"
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": "*Status* :fire:  \n Open"
                },
                {
                    "type": "mrkdwn",
                    "text": `*Reporter* :man-surfing: \n <@${user}>`
                },
                {
                    "type": "mrkdwn",
                    "text": `*Environment* :house_with_garden: \n ${environment}`
                }
            ]
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": `*PR / build URLs* :link: \n${prBuildUrl}`
                }
            ]
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
            "block_id": "actions",
            "elements": [
                {
                    "type": "users_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Unassigned",
                        "emoji": true
                    },
                    "action_id": "assign_help_request_to_user"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": ":raising_hand: Take it",
                        "emoji": true
                    },
                    "style": "primary",
                    "value": "assign_help_request_to_me",
                    "action_id": "assign_help_request_to_me"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": ":female-firefighter: Start",
                        "emoji": true
                    },
                    "style": "primary",
                    "value": "start_help_request",
                    "action_id": "start_help_request"
                }
            ]
        },
        {
            "type": "divider"
        }
    ]
}

function helpRequestDetails(
    {
        description,
        analysis,
    }) {
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `:spiral_note_pad: Description: ${description}`,
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `:thinking_face: Analysis: ${analysis}`,
            }
        },
    ]
}

function appHomeUnassignedIssues() {
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
        {
            "type": "divider"
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*<https://example.com|Unassigned issue 1>* \n :alarm_clock: Opened: some date\n :hourglass:Last updated: some date"
            }
        },
        {
            "type": "divider"
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*<https://example.com|Unassigned issue 2>*"
            }
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "users_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Assign to",
                        "emoji": true
                    },
                    "action_id": "users_select-action"
                },
                {
                    "type": "button",
                    "action_id": "take_unassigned_issue",
                    "text": {
                        "type": "plain_text",
                        "text": ":eyes: Take it"
                    },
                    "style": "primary"
                }
            ]
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": "*:alarm_clock: Opened:*\n Mar 10, 2015 (3 years, 5 months)"
                },
                {
                    "type": "mrkdwn",
                    "text": "*:hourglass: Last Updated:*\n Yesterday"
                },
                {
                    "type": "mrkdwn",
                    "text": "*View on Jira*:\n <https://tools.hmcts.net/jira/browse/SBOX-63|SBOX-63>"
                }
            ]
        },
        {
            "type": "divider"
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*<https://example.com|Unassigned issue 3>*\n_No help request found_"
            }
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "users_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Assign to",
                        "emoji": true
                    },
                    "action_id": "users_select-action"
                },
                {
                    "type": "button",
                    "action_id": "take_unassigned_issue",
                    "text": {
                        "type": "plain_text",
                        "text": ":eyes: Take it"
                    },
                    "style": "primary"
                },
                {
                    "type": "button",
                    "action_id": "create_help_request_from_jira",
                    "text": {
                        "type": "plain_text",
                        "text": ":eyes: Create help request"
                    },
                    "style": "primary"
                }
            ]
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": "*:alarm_clock: Opened:*\n Mar 10, 2015 (3 years, 5 months)"
                },
                {
                    "type": "mrkdwn",
                    "text": "*:hourglass: Last Updated:*\n Yesterday"
                },
                {
                    "type": "mrkdwn",
                    "text": "*View on Jira*:\n <https://tools.hmcts.net/jira/browse/SBOX-63|SBOX-63>"
                }
            ]
        }
    ]
}

function option(name, option) {
    return {
        text: {
            type: "plain_text",
            text: name,
            emoji: true
        },
        value: option ?? name.toLowerCase()
    }
}

function openHelpRequestBlocks() {
    return {
        "title": {
            "type": "plain_text",
            "text": "Platform help request"
        },
        "submit": {
            "type": "plain_text",
            "text": "Submit"
        },
        "blocks": [
            {
                "type": "input",
                "block_id": "summary",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "title",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Short description of the issue"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "Issue summary"
                }
            },
            {
                "type": "input",
                "block_id": "urls",
                "optional": true,
                "element": {
                    "type": "plain_text_input",
                    "action_id": "title",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Link to any build or pull request"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "PR / build URLs"
                }
            },
            {
                "type": "input",
                "block_id": "environment",
                "optional": true,
                "element": {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Choose an environment",
                        "emoji": true
                    },
                    "options": [
                        option('AAT / Staging', 'staging'),
                        option('Preview / Dev', 'dev'),
                        option('Production'),
                        option('Perftest / Test', 'test'),
                        option('ITHC'),
                        option('N/A', 'none')
                    ],
                    "action_id": "environment"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Environment",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "description",
                "element": {
                    "type": "plain_text_input",
                    "multiline": true,
                    "action_id": "description"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Issue description",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "analysis",
                "element": {
                    "type": "plain_text_input",
                    "multiline": true,
                    "action_id": "analysis"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Analysis done so far",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "checked_with_team",
                "element": {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select an item",
                        "emoji": true
                    },
                    "options": [
                        option('No'),
                        option('Yes')
                    ],
                    "action_id": "checked_with_team"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Have you checked with your team?",
                    "emoji": true
                }
            },
        ],
        "type": "modal",
        callback_id: 'create_help_request'
    }

}

module.exports.appHomeUnassignedIssues = appHomeUnassignedIssues;
module.exports.helpRequestRaised = helpRequestRaised;
module.exports.helpRequestDetails = helpRequestDetails;
module.exports.openHelpRequestBlocks = openHelpRequestBlocks;
