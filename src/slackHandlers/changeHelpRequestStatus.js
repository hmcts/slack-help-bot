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

const allowedStatuses = Object.keys(statusIcons);

function getStatus(statusText) {
  return allowedStatuses.find(
    (status) => status.toLowerCase() === statusText.trim().toLowerCase(),
  );
}

async function updateSlackTicketStatus({ client, channel, message, status }) {
  const jiraId = extractJiraIdFromBlocks(message.blocks);
  await updateIssueStatus(jiraId, status);

  const statusField = message.blocks[2]?.fields?.[0];
  if (!statusField) {
    throw new Error(`Could not find the status field for ${jiraId}`);
  }

  statusField.text = `Status ${statusIcons[status]}:\n ${status}`;

  await client.chat.update({
    channel,
    ts: message.ts,
    text: "New platform help request raised",
    blocks: message.blocks,
  });

  return jiraId;
}

async function changeHelpRequestStatusFromCommand({ event, client, message }) {
  const statusText = event.text.trim().replace(/^help\s+status\s+/i, "");
  const status = getStatus(statusText);

  if (!status) {
    await client.chat.postEphemeral({
      channel: event.channel,
      user: event.user,
      thread_ts: event.thread_ts,
      text: `Unknown status. Choose one of: ${allowedStatuses.join(", ")}.`,
    });
    return true;
  }

  try {
    await updateSlackTicketStatus({
      client,
      channel: event.channel,
      message,
      status,
    });
    await client.reactions.add({
      name: "white_check_mark",
      timestamp: event.ts,
      channel: event.channel,
    });
  } catch (error) {
    console.error("Error changing ticket status from Slack command", error);
    await client.chat.postEphemeral({
      channel: event.channel,
      user: event.user,
      thread_ts: event.thread_ts,
      text: `I could not change the ticket to ${status}. Check that the Jira workflow allows this transition.`,
    });
  }

  return true;
}

module.exports.changeHelpRequestStatusFromCommand =
  changeHelpRequestStatusFromCommand;
module.exports.getStatus = getStatus;