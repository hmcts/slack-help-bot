const {
  extractJiraIdFromBlocks,
  startHelpRequest,
  removeWithdrawnLabel,
} = require("../service/persistence");

async function startHelpRequestHandler(body, client, area) {
  try {
    const jiraId = extractJiraIdFromBlocks(body.message.blocks);

    await startHelpRequest(jiraId); // TODO add optional resolution comment

    await removeWithdrawnLabel(jiraId); // Require when re-opening a withdrawn issue via slack

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
      action_id: `resolve_help_request${area === "crime" ? "_crime" : ""}`,
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
