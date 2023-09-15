const {WorkflowStep} = require("@slack/bolt");
const {getAllServiceStatus} = require("../service/serviceStatus");
const {getAllProducts} = require("../service/serviceStatus");
const config = require("config");
const reportChannelId = config.get('slack.report_channel_id');

function getServiceStatusWorkflowStep() {
    return new WorkflowStep('get_service_status_step', {
        edit: async ({ ack, step, configure, client }) => {
            await ack();

            const blocks = workflowStepBlocks(step.inputs);
            await configure({ blocks });
        },
        save: async ({ ack, step, view, update, client }) => {
            await ack();

            const { values } = view.state;
            const inputs = workflowStepView(values);
            const outputs = [];
            await update({ inputs, outputs });
        },
        execute: async ({ step, complete, fail, client }) => {
            const blocks = [];
            const products = getAllProducts();
            const env = step.inputs.env.value;

            blocks.push({
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "Common Services " + env.toUpperCase(),
                }
            });
        
            products.forEach(product => {
                if (product.services[env].length > 0) {
                    blocks.push({
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": product.getMarkdown(env)
                        }
                    });
                }
            });
        
            blocks.push({ "type": "divider" });
            
            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `\n>This is up to date as of ${new Date().toLocaleString()} UTC \n`
                }
            });

            console.log(JSON.stringify(blocks));

            try {
                await client.chat.postEphemeral({
                    channel: reportChannelId,
                    user: step.inputs.user.value,
                    username: 'Common Services Environments',
                    blocks: blocks,
                    text: 'Service status'
                });
            } catch (error) {
                console.error(error);
            }
        }
    });
}

function workflowStepBlocks(inputs) {
    return [
        {
            "type": "input",
            "block_id": "user",
            "label": {
                "type": "plain_text",
                "text": "Ticket raiser"
            },
            "element": {
                "type": "users_select",
                "action_id": "user",
                "initial_user": inputs?.user?.value ?? " ",
            }
        },
        {
            "type": "input",
            "block_id": "env",
            "label": {
                "type": "plain_text",
                "text": "Environment"
            },
            "element": {
				"type": "static_select",
				"placeholder": {
					"type": "plain_text",
					"text": "Select an environment",
					"emoji": true
				},
				"options": [
					{
						"text": {
							"type": "plain_text",
							"text": "Production",
							"emoji": true
						},
						"value": "prod"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "AAT",
							"emoji": true
						},
						"value": "aat"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "Demo",
							"emoji": true
						},
						"value": "demo"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "Perftest",
							"emoji": true
						},
						"value": "perftest"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "ITHC",
							"emoji": true
						},
						"value": "ithc"
					}
				],
				"action_id": "env"
			}
        }
    ];
}

function workflowStepView(values) {
    return {
        user: {
            value: values.user.user.selected_user
        },
        env: {
            value: values.env.env.selected_option.value
        }
    }
}

module.exports.getServiceStatusWorkflowStep = getServiceStatusWorkflowStep