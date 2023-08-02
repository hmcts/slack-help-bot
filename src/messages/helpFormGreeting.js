function helpFormGreetingBlocks({ user, isAdvanced }) {
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `Hello <@${user}> :wave:\nAre you looking for some dedicated help from Platform Operation? As the team is busy working to improve the platform, please be aware that it is all self-service.`
            }
        },
        {
            "type": "divider"
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Before you raise a request, please make sure:*"
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ":white_check_mark:  You have read our <https://hmcts.github.io/|ways of working documentation> to help you in onboarding new people / teams to platform, path to live for apps and some <https://hmcts.github.io/cloud-native-platform/troubleshooting/|troubleshooting guides>."
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ":white_check_mark:  You have read recent announcements on #cloud-native-announce and discussions on community channels like #cloud-native for any recent changes done or issues being investigated."
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ":white_check_mark:  Your question is not very generic as forums like #cloud-native are best place to ask and discuss them."
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ":white_check_mark:  You have asked with in your team and they suggested that it is a platform issue"
            }
        },
        {
            "type": "divider"
        },
        isAdvanced ?
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `<@${user}> clicked *I Still Need Help*`
            }
        } :
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "I Still Need Help",
                        "emoji": true
                    },
                    "action_id": "show_plato_dialogue"
                }
            ]
        }
    ]
}

module.exports.helpFormGreetingBlocks = helpFormGreetingBlocks;
