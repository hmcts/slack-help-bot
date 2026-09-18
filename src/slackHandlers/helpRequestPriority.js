const config = require("config");
const { assessPriority } = require("../ai/ai");
const { sanitizePriority, isPriorityIncrease } = require("../ai/priority");
const {
  extractJiraIdFromBlocks,
  updateHelpRequestPriority,
} = require("../service/persistence");
const { updateHelpRequestPriorityInCosmos } = require("../service/cosmos");
const appInsights = require("../modules/appInsights");

const bauUserGroupId = config.get("slack.bau_user_group_id");
const priorityLabels = {
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

function escapeSlackText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getPriorityFromBlocks(blocks = []) {
  const priorityField = blocks
    .flatMap((block) => block.fields ?? [])
    .find((field) => field.text?.startsWith("*Priority*"));
  const value = priorityField?.text?.split("\n").pop()?.trim()?.toLowerCase();
  return sanitizePriority(value);
}

function setPriorityInBlocks(blocks, priority) {
  const label = priorityLabels[sanitizePriority(priority)];
  let priorityField = blocks
    .flatMap((block) => block.fields ?? [])
    .find((field) => field.text?.startsWith("*Priority*"));

  if (!priorityField) {
    const metadataBlock = blocks.find((block) => Array.isArray(block.fields));
    if (!metadataBlock) {
      return blocks;
    }
    priorityField = { type: "mrkdwn", text: "" };
    metadataBlock.fields.push(priorityField);
  }
  priorityField.text = `*Priority* :rotating_light: \n ${label}`;
  return blocks;
}

async function applyPriorityChange({
  client,
  channel,
  rootMessage,
  priority,
  reasons = [],
  source,
  notifyBau = false,
}) {
  const sanitizedPriority = sanitizePriority(priority);
  const jiraId = extractJiraIdFromBlocks(rootMessage.blocks);
  const blocks = setPriorityInBlocks(
    structuredClone(rootMessage.blocks),
    sanitizedPriority,
  );

  const jiraPriorityUpdated = await updateHelpRequestPriority(
    jiraId,
    sanitizedPriority,
  );
  if (!jiraPriorityUpdated) {
    throw new Error(`Jira rejected the priority change for ${jiraId}`);
  }
  await updateHelpRequestPriorityInCosmos(jiraId, sanitizedPriority, reasons);
  await client.chat.update({
    channel,
    ts: rootMessage.ts,
    text: rootMessage.text || "New platform help request raised",
    blocks,
  });

  if (notifyBau && bauUserGroupId) {
    const reasonText =
      reasons.length > 0
        ? ` because ${escapeSlackText(reasons.join("; "))}`
        : "";
    await client.chat.postMessage({
      channel,
      thread_ts: rootMessage.ts,
      text: `<!subteam^${bauUserGroupId}> ${jiraId} has been raised to ${priorityLabels[sanitizedPriority]} priority${reasonText}. Please verify the priority.`,
    });
  }

  appInsights.trackEvent("Help request priority changed", {
    key: jiraId,
    priority: sanitizedPriority,
    source,
  });
}

function formatRecentThreadMessages(threadMessages, fallbackText) {
  if (!Array.isArray(threadMessages)) {
    return fallbackText;
  }

  return threadMessages
    .filter((message) => !message.bot_id && typeof message.text === "string")
    .slice(-20)
    .map((message) => message.text.slice(0, 1000))
    .join("\n");
}

async function monitorThreadPriority({
  event,
  rootMessage,
  threadMessages,
  client,
}) {
  try {
    const currentPriority = getPriorityFromBlocks(rootMessage.blocks);
    const title =
      rootMessage.blocks?.find((block) => block.type === "section")?.text
        ?.text || "Unknown help request";
    const recentThread = formatRecentThreadMessages(threadMessages, event.text);
    const assessment = await assessPriority(
      `Help request: ${title}\nRecent thread messages:\n${recentThread}`,
    );

    if (assessment.confidence === "low") {
      return;
    }

    // Critical is reserved for high-confidence, explicit operational impact.
    const suggestedPriority =
      assessment.priority === "critical" && assessment.confidence !== "high"
        ? "high"
        : assessment.priority;

    if (!isPriorityIncrease(currentPriority, suggestedPriority)) {
      return;
    }

    await applyPriorityChange({
      client,
      channel: event.channel,
      rootMessage,
      priority: suggestedPriority,
      reasons: assessment.reasons,
      source: "automatic_thread_monitor",
      notifyBau: true,
    });
  } catch (error) {
    // Priority assessment must never stop Slack replies being mirrored to Jira.
    console.error("Unable to reassess help request priority", error);
  }
}

async function changeHelpRequestPriority(action, body, client) {
  const priority = sanitizePriority(action.selected_option?.value);
  const currentPriority = getPriorityFromBlocks(body.message.blocks);
  if (priority === currentPriority) {
    return;
  }
  try {
    await applyPriorityChange({
      client,
      channel: body.channel.id,
      rootMessage: body.message,
      priority,
      source: "manual_slack_override",
      notifyBau: isPriorityIncrease(currentPriority, priority),
    });
  } catch (error) {
    console.error("Unable to change help request priority", error.message);
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      thread_ts: body.message.ts,
      text: "Jira rejected the priority change. The request priority was not changed. Please check the bot logs for Jira's field error.",
    });
  }
}

module.exports = {
  getPriorityFromBlocks,
  setPriorityInBlocks,
  applyPriorityChange,
  monitorThreadPriority,
  changeHelpRequestPriority,
  formatRecentThreadMessages,
};
