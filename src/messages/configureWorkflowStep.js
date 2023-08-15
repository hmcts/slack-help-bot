function configureWorkflowStepBlocks(inputs) {
	return [
		{
			type: "input",
			block_id: "user_block",
			label: {
				type: "plain_text",
				text: "User who started the workflow",
			},
			element: {
				type: "users_select",
				action_id: "user_input",
				initial_user: inputs?.user?.value ?? " ",
			},
		},
	];
}

module.exports.configureWorkflowStepBlocks = configureWorkflowStepBlocks;
