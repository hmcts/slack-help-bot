function appHomeHeaderBlocks(title, breakdown = "") {
    return [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: title,
                emoji: true,
            },
        },
        {
            type: "section",
            text: {
                type: "plain_text",
                text: breakdown,
                emoji: true,
            },
        },
        {
            type: "divider",
        },
    ];
}

module.exports.appHomeHeaderBlocks = appHomeHeaderBlocks;
