const {
  extractJiraIdFromBlocks,
  startHelpRequest,
} = require("../service/persistence");

async function startHelpRequestHandler(body, client) {
  try {
    const jiraId = extractJiraIdFromBlocks(body.message.blocks);

    await startHelpRequest(jiraId); // TODO add optional resolution comment

    const blocks = body.message.blocks;
    // TODO less fragile block updating
    blocks[6].elements[2] = {
      type: "button",
      text: {
        type: "plain_text",
        text: ":snow_cloud: Resolve",
        emoji: true,
      },
      style: "primary",
      value: "resolve_help_request",
      action_id: "resolve_help_request",
    };

    blocks[2].fields[0].text = "Status :fire_extinguisher:\n In progress";

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "New platform help request raised",
      blocks: blocks,
    });
  } catch (error) {
    console.error(error);
  }
}

module.exports.startHelpRequestHandler = startHelpRequestHandler;
