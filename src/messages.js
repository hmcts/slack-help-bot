const { convertIso8601ToEpochSeconds } = require('./dateHelper');

function convertJiraKeyToUrl(jiraId) {
    return `https://tools.hmcts.net/jira/browse/${jiraId}`;
}

const config = require('config')

const slackChannelId = config.get('slack.report_channel_id')
const slackMessageIdRegex = new RegExp(`${slackChannelId}\/(.*)\\|`)

const slackLinkRegex = /view in Slack\|(https:\/\/.+slack\.com.+)]/

function extractSlackMessageIdFromText(text) {
    if (text === undefined) {
        return undefined
    }

    const regexResult = slackMessageIdRegex.exec(text);
    if (regexResult === null) {
        return undefined
    }
    return regexResult[1]
}

function extractSlackLinkFromText(text) {
    if (text === undefined) {
        return undefined
    }

    const regexResult = slackLinkRegex.exec(text);
    if (regexResult === null) {
        return undefined
    }
    return regexResult[1]
}

function stringTrim(string, maxLength) {
    const truncationMessage = '... [Truncated] see Jira for rest of message.';

    if (string.length >= maxLength) {
        return string.slice(0, maxLength - truncationMessage.length).concat(truncationMessage);
    } else {
        return string;
    }
}

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
                    "text": `View on Jira: <${convertJiraKeyToUrl(jiraId)}|${jiraId}>`
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
                "text": stringTrim(`:spiral_note_pad: Description: ${description}`, 3000),
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": stringTrim(`:thinking_face: Analysis: ${analysis}`, 3000),
            }
        },
    ]
}

function unassignedOpenIssue({
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

function appHomeUnassignedIssues(openIssueBlocks) {
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
                "block_id": "area",
                "element": {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select an item",
                        "emoji": true
                    },
                    "options": [
                        option("AKS"),
                        option("Azure"),
                        option("Azure DevOps", "azure-devops"),
                        option("Database read", "DBQuery"),
                        option("Database update", "DBUpdate"),
                        option("Elasticsearch"),
                        option("GitHub"),
                        option("Jenkins"),
                        option("Other"),
                        option("Question"),
                        option("SSL"),
                        option("VPN"),
                    ],
                    "action_id": "area"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Which area do you need help in?",
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
                "block_id": "team",
                "element": {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select other if missing",
                        "emoji": true
                    },
                    "options": [
                        option('Access Management', 'am'),
                        option('Architecture'),
                        option('Bulk scan', 'bulkscan'),
                        option('Bulk print', 'bulkprint'),
                        option('CCD'),
                        option('Civil Unspecified', 'CivilUnspec'),
                        option('CMC'),
                        option('Divorce'),
                        option('No fault divorce', 'nfdivorce'),
                        option('Ethos'),
                        option('Evidence Management', 'evidence'),
                        option('Expert UI', 'xui'),
                        option('Financial Remedy', 'finrem'),
                        option('FPLA'),
                        option('Family Private Law', 'FPRL'),
                        option('Heritage'),
                        option('HMI'),
                        option('Management Information', 'mi'),
                        option('IDAM'),
                        option('Other'),
                        option('Private Law','private-law'),
                        option('Reference Data', 'refdata'),
                        option('Reform Software Engineering', 'reform-software-engineering'),
                        option('Security Operations or Secure design', 'security'),
                        option('SSCS'),
                        option('PayBubble'),
                        option('PET'),
                        option('Work Allocation', 'workallocation'),
                    ],
                    "action_id": "team"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Which team are you from?",
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

function superBotMessageBlocks(inputs) {
    return [
        {
            "type": "input",
            "block_id": 'summary_block',
            "label": {
                "type": "plain_text",
                "text": "Summary"
            },
            "element": {
                "type": "plain_text_input",
                "action_id": "summary_input",
                "initial_value": inputs?.summary?.value ?? ""
            }
        },
        {
            "type": "input",
            "block_id": 'env_block',
            "label": {
                "type": "plain_text",
                "text": "Environment"
            },
            "element": {
                "type": "plain_text_input",
                "action_id": "env_input",
                "initial_value": inputs?.env?.value ?? ""
            }
        },
        {
            "type": "input",
            "block_id": 'team_block',
            "label": {
                "type": "plain_text",
                "text": "Team"
            },
            "element": {
                "type": "plain_text_input",
                "action_id": "team_input",
                "initial_value": inputs?.team?.value ?? ""
            }
        },
        {
            "type": "input",
            "block_id": 'area_block',
            "label": {
                "type": "plain_text",
                "text": "Area"
            },
            "element": {
                "type": "plain_text_input",
                "action_id": "area_input",
                "initial_value": inputs?.area?.value ?? ""
            }
        },
        {
            "type": "input",
            "block_id": 'build_block',
            "label": {
                "type": "plain_text",
                "text": "PR / build URLs"
            },
            "element": {
                "type": "plain_text_input",
                "action_id": "build_input",
                "initial_value": inputs?.build?.value ?? ""
            }
        },
        {
            "type": "input",
            "block_id": 'desc_block',
            "label": {
                "type": "plain_text",
                "text": "Description"
            },
            "element": {
                "type": "plain_text_input",
                "action_id": "desc_input",
                "initial_value": inputs?.desc?.value ?? ""
            }
        },
        {
            "type": "input",
            "block_id": 'alsys_block',
            "label": {
                "type": "plain_text",
                "text": "Analysis done so far, or additional context"
            },
            "element": {
                "type": "plain_text_input",
                "action_id": "alsys_input",
                "initial_value": inputs?.alsys?.value ?? ""
            }
        },
        {
            "type": "input",
            "block_id": 'team_check_block',
            "label": {
                "type": "plain_text",
                "text": "Have you checked with your team?"
            },
            "element": {
                "type": "plain_text_input",
                "action_id": "team_check_input",
                "initial_value": inputs?.team_check?.value ?? ""
            }
        },
        {
            "type": "input",
            "block_id": 'user_block',
            "label": {
                "type": "plain_text",
                "text": "Ticket Raiser"
            },
            "element": {
                "type": "users_select",
                "action_id": "user_input",
                "initial_user": inputs?.user?.value ?? " ",
            }
        },
    ];
}
function duplicateHelpRequest({
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
                text: summary
            }
        },
        {
            type: "divider"
        },
        {
            type: "section",
            fields: [
                {
                    type: "mrkdwn",
                    text: `View on Jira: <${convertJiraKeyToUrl(currentIssueJiraId)}|${currentIssueJiraId}>`
                },
                {
                    type: "mrkdwn",
                    text: `Duplicate of <${parentSlackUrl}|${parentJiraId}>`
                }
            ]
        }
    ]
}

function resolveHelpRequestBlocks({thread_ts}) {
    return {
        "title": {
            "type": "plain_text",
            "text": "Document Help Request"
        },
        "submit": {
            "type": "plain_text",
            "text": "Document"
        },
        "blocks": [
            {
                "type": "section",
                "block_id": "title_block",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Run into this problem often?*"
                }
            },
            {
                "type": "section",
                "block_id": "subtitle_block",
                "text": {
                    "type": "plain_text",
                    "text": "Write some documentation to help out next time!\nKeep answers brief, but make them informative.",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "category_block",
                "element": {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select an item",
                        "emoji": true
                    },
                    "options": [
                        option('Application code/config issue'),
                        option('External (GitHub/Azure/SonarCloud) issue'),
                        option('Lack of access'),
                        option('Lack of documentation'),
                        option('Platform issue'),
                        option('User did not do enough troubleshooting'),
                        option('User error'),
                        option('Working as per design'),
                        option('Other')
                    ],
                    "action_id": "category"
                },
                "label": {
                    "type": "plain_text",
                    "text": "What was the issue?",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "how_block",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "how",
                    "multiline": true,
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Provide some details?"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": ":bulb: How?\n (Provide some details)"
                },
                "optional": true
            }
        ],
        "type": "modal",
        "callback_id": 'document_help_request',
        // We use the private_metadata field to smuggle the ts of the thread
        // into the form so the bot knows where to reply when the form is submitted
        "private_metadata": `${thread_ts}`,
    }

}

function helpRequestDocumentation({category, how}) {
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Help Provided:*"
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `:exclamation: *What:* ${category}`
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `:bulb: *How:* ${how}`
            }
        }
    ];
}

module.exports.appHomeUnassignedIssues = appHomeUnassignedIssues;
module.exports.unassignedOpenIssue = unassignedOpenIssue;
module.exports.helpRequestRaised = helpRequestRaised;
module.exports.helpRequestDetails = helpRequestDetails;
module.exports.openHelpRequestBlocks = openHelpRequestBlocks;
module.exports.extractSlackLinkFromText = extractSlackLinkFromText;
module.exports.extractSlackMessageIdFromText = extractSlackMessageIdFromText;
module.exports.superBotMessageBlocks = superBotMessageBlocks;
module.exports.duplicateHelpRequest = duplicateHelpRequest;
module.exports.resolveHelpRequestBlocks = resolveHelpRequestBlocks;
module.exports.helpRequestDocumentation = helpRequestDocumentation;
