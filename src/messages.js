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
            "text": {
                "type": "plain_text",
                "text": `:fire: Status: Open`,
                "emoji": true
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `:woman-surfing: Reporter: <@${user}>`,
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ":female-firefighter: Assigned to: "
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
                "type": "plain_text",
                "text": `:link: PR / build URLs: ${prBuildUrl}`,
                "emoji": true
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
                        "text": ":snow_cloud: Resolve",
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

function helpRequestDetails(
    {
        description,
        analysis,
    }) {
    return [
        {
            "type": "section",
            "text": {
                "type": "plain_text",
                "text": `:spiral_note_pad: Description: ${description}`,
                "emoji": true
            }
        },
        {
            "type": "section",
            "text": {
                "type": "plain_text",
                "text": `:thinking_face: Analysis: ${analysis}`,
                "emoji": true
            }
        },
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

module.exports.helpRequestRaised = helpRequestRaised;
module.exports.helpRequestDetails = helpRequestDetails;
module.exports.openHelpRequestBlocks = openHelpRequestBlocks;
