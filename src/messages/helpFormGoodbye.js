function helpFormGoodbyeBlocks({ helpRequestUrl }) {
	return [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: "Help Request Submitted",
				emoji: true,
			},
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `Thank you for submitting a help request with PlatOps.\n<${helpRequestUrl}|View your help request>`,
			},
		},
	];
}

module.exports.helpFormGoodbyeBlocks = helpFormGoodbyeBlocks;
