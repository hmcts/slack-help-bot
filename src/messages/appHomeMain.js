function appHomeMainBlocks() {
	return [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: "PlatOps Help Bot",
				emoji: true,
			},
		},
		{
			type: "section",
			text: {
				type: "plain_text",
				text: "Generate a report:",
				emoji: true,
			},
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "Open unassigned help requests",
						emoji: true,
					},
					value: "view_open_unassigned_requests",
					action_id: "view_open_unassigned_requests",
				},
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "Assigned to me",
						emoji: true,
					},
					value: "view_requests_assigned_to_me",
					action_id: "view_requests_assigned_to_me",
				},
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "Raised by me",
						emoji: true,
					},
					value: "view_requests_raised_by_me",
					action_id: "view_requests_raised_by_me",
				},
			],
		},
		{
			type: "divider",
		},
	];
}

module.exports.appHomeMainBlocks = appHomeMainBlocks;
