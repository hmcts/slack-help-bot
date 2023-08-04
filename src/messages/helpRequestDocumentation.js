function helpRequestDocumentationBlocks({ category, how }) {
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

module.exports.helpRequestDocumentationBlocks = helpRequestDocumentationBlocks;