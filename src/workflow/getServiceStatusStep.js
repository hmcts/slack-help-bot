const {WorkflowStep} = require("@slack/bolt");
const {getAllServiceStatus} = require("../service/serviceStatus");
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

            Object.entries(getAllServiceStatus()).forEach(([envName, services]) => {
                blocks.push({
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "Common Services " + envName,
                    }
                });

                services.forEach(service => {
                    blocks.push({
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": service.toString()
                        }
                    });
                })

                blocks.push({ "type": "divider" });
            })

            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `\n>This is up to date as of ${new Date().toLocaleString()} UTC \n`
                }
            });

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
        }
    ];
}

function workflowStepView(values) {
    return {
        user: {
            value: values.user.user.selected_user
        }
    }
}

module.exports.getServiceStatusWorkflowStep = getServiceStatusWorkflowStep