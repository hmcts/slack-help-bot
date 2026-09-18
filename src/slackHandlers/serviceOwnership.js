const { getPriorityFromBlocks } = require("./helpRequestPriority");
const { getServiceCatalogueCached } = require("../service/serviceCatalogue");
const {
  identifyServiceOwnershipCached,
} = require("./utils/serviceOwnershipCache");
const { buildIncidentContext } = require("./utils/incidentContext");

const OWNERSHIP_BLOCK_ID = "service_ownership";

function hasServiceOwnership(blocks = []) {
  return blocks.some((block) => block.block_id === OWNERSHIP_BLOCK_ID);
}

function escapeSlackText(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatOwnership(result, catalogue, jiraMarkup = false) {
  const contacts = result.contacts.length
    ? result.contacts.map(escapeSlackText).join(" / ")
    : "No named contact listed";
  const services = result.matchedServices.length
    ? result.matchedServices.map(escapeSlackText).join(", ")
    : "No exact component match";
  const source = jiraMarkup
    ? `[Service and Component Catalogue|${catalogue.url}]`
    : `<${catalogue.url}|Service and Component Catalogue>`;
  return `*Suggested service owner*: ${escapeSlackText(result.owningTeam)}\n*Speak to*: ${contacts}\n*Matched components*: ${services}\n${escapeSlackText(result.reason)}\n_Source: ${source}; ${result.confidence} confidence_`;
}

async function triageCriticalOwnership({
  event,
  rootMessage,
  threadMessages,
  client,
  jiraId,
  slackLink,
  addJiraComment,
}) {
  if (
    getPriorityFromBlocks(rootMessage.blocks) !== "critical" ||
    hasServiceOwnership(rootMessage.blocks)
  ) {
    return false;
  }

  try {
    const catalogue = await getServiceCatalogueCached();
    const incidentContext = buildIncidentContext(
      rootMessage,
      threadMessages,
      event.text,
    );
    const result = await identifyServiceOwnershipCached(
      catalogue,
      incidentContext,
    );
    if (result.confidence === "low" || !result.owningTeam) return false;

    const text = formatOwnership(result, catalogue);
    const blocks = [
      ...structuredClone(rootMessage.blocks),
      {
        type: "section",
        block_id: OWNERSHIP_BLOCK_ID,
        text: { type: "mrkdwn", text },
      },
    ];
    await client.chat.update({
      channel: event.channel,
      ts: rootMessage.ts,
      text: rootMessage.text || "New platform help request raised",
      blocks,
    });
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: rootMessage.ts,
      text,
      unfurl_links: false,
    });
    await addJiraComment?.(jiraId, {
      slackLink,
      name: "Slack Help Bot – service ownership triage",
      message: formatOwnership(result, catalogue, true),
    });
    return true;
  } catch (error) {
    console.error("Unable to identify critical incident service owner", {
      message: error.message,
    });
    return false;
  }
}

module.exports = {
  OWNERSHIP_BLOCK_ID,
  hasServiceOwnership,
  formatOwnership,
  triageCriticalOwnership,
};
