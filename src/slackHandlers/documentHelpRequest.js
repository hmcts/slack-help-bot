const {
  extractJiraIdFromBlocks,
  resolveHelpRequest,
  addCommentToHelpRequestResolve,
  addLabel,
} = require("../service/persistence");
const { helpRequestDocumentationBlocks } = require("../messages");

const config = require("config");
const { updateCosmosWhenHelpRequestResolved } = require("../service/cosmos");

const reportChannel = config.get("slack.report_channel");
const reportChannelId = config.get("slack.report_channel_id");

async function documentHelpRequest(client, body, area) {
  try {
    const helpRequestMessages = (
      await client.conversations.replies({
        channel: reportChannelId,
        ts: body.view.private_metadata,
        limit: 200, // after a thread is 200 long we'll break but good enough for now
      })
    ).messages;

    const jiraId = extractJiraIdFromBlocks(helpRequestMessages[0].blocks);

    await resolveHelpRequest(jiraId);

    const blocks = helpRequestMessages[0].blocks;
    // TODO less fragile block updating
    blocks[6].elements[2] = {
      type: "button",
      text: {
        type: "plain_text",
        text: ":snow_cloud: Re-open",
        emoji: true,
      },
      style: "primary",
      value: "start_help_request",
      action_id: `start_help_request${area === "crime" ? "_crime" : ""}`,
    };

    blocks[2].fields[0].text = "Status :snowflake:\n Done";

    await client.chat.update({
      channel: reportChannelId,
      ts: body.view.private_metadata,
      text: "New platform help request raised",
      blocks: blocks,
    });

    const documentation = {
      category:
        body.view.state.values.category_block.category.selected_option.value,
      how: body.view.state.values.how_block.how.value || "N/A",
    };

    await addCommentToHelpRequestResolve(jiraId, documentation);

    await addLabel(jiraId, documentation);

    await client.chat.postMessage({
      channel: reportChannel,
      thread_ts: body.view.private_metadata,
      text: "Platform help request documented",
      blocks: helpRequestDocumentationBlocks(documentation),
    });

    await updateCosmosWhenHelpRequestResolved({
      key: jiraId,
      status: "Done",
      resolution: documentation.how,
      resolution_type: documentation.category,
    });
  } catch (error) {
    console.error(error);
  }
}

module.exports.documentHelpRequest = documentHelpRequest;
