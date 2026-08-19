const {
  extractJiraIdFromBlocks,
  updateIssueStatus,
} = require("../service/persistence");

const statusIcons = {
  Withdrawn: ":snow_cloud:",
  Blocked: ":no_entry:",
  Rejected: ":x:",
  Triaged: ":mag:",
  "In Progress": ":fire_extinguisher:",
  "In review": ":eyes:",
};

async function changeHelpRequestStatus(body, client) {
  const status = body.actions[0].selected_option.value;
  const jiraId = extractJiraIdFromBlocks(body.message.blocks);

  try {
    await updateIssueStatus(jiraId, status);

    const blocks = body.message.blocks;
    blocks[2].fields[0].text = `Status ${statusIcons[status] ?? ""}:\n ${status}`;

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "New platform help request raised",
      blocks,
    });
  } catch (error) {
    console.error(`Error changing status for issue ${jiraId}`, error);
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      thread_ts: body.message.ts,
      text: `Unable to change ${jiraId} to ${status}. Check that the Jira workflow allows this transition.`,
    });
  }
}

module.exports.changeHelpRequestStatus = changeHelpRequestStatus;