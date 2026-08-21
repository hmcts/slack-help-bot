const { findReleaseFamily } = require("../service/releaseNotes");
const { summariseReleasePagesCached } = require("./utils/releaseSummaryCache");
const { getPriorityFromBlocks } = require("./helpRequestPriority");
const { buildIncidentContext } = require("./utils/incidentContext");

const LAST_RELEASE_PATTERN =
  /\blast\s+(?:production\s+)?release\s*(?:was|is|:)?\s*(?:CPP[\s_-]*)?(\d{2}\.\d{1,2})(?!\d)/i;
const RELEASE_FOLLOW_UP_PATTERN = /^\s*follow[ -]?up\s*:\s*(.+)$/i;

function extractReleaseFamily(text = "") {
  return text.match(LAST_RELEASE_PATTERN)?.[1] || null;
}

function extractReleaseFollowUp(text = "") {
  return text.match(RELEASE_FOLLOW_UP_PATTERN)?.[1]?.trim() || null;
}

function findRecentReleaseFamily(threadMessages = []) {
  return threadMessages
    .map((message) => extractReleaseFamily(message.text))
    .filter(Boolean)
    .pop();
}

function formatSources(pages) {
  return pages
    .map((page, index) => `[${index + 1}] <${page.url}|${page.title}>`)
    .join("\n");
}

function formatJiraSources(pages) {
  return pages
    .map((page, index) => `[${index + 1}] [${page.title}|${page.url}]`)
    .join("\n");
}

async function followUpWithReleaseNotes({
  event,
  rootMessage,
  client,
  jiraId,
  slackLink,
  addJiraComment,
  threadMessages,
}) {
  const followUpFocus = extractReleaseFollowUp(event.text);
  const releaseFamily =
    extractReleaseFamily(event.text) ||
    (followUpFocus ? findRecentReleaseFamily(threadMessages) : null);
  if (!releaseFamily && !followUpFocus) return false;
  if (!releaseFamily) {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: rootMessage.ts,
      text: 'I need the release family first. For example, send "Last release was 26.22", then ask the follow-up again.',
    });
    return true;
  }

  if (getPriorityFromBlocks(rootMessage.blocks) !== "critical") {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: rootMessage.ts,
      text: "Release-note investigation currently runs only for requests marked Critical. Change the request priority to Critical and send the last-release message again.",
    });
    return true;
  }

  try {
    const pages = await findReleaseFamily(releaseFamily);
    if (pages.length === 0) {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: rootMessage.ts,
        text: `I couldn't find a CPP ${releaseFamily} release page beneath Functional Releases.`,
      });
      return true;
    }

    const incidentContext = buildIncidentContext(
      rootMessage,
      threadMessages,
      event.text,
    );
    const summary = await summariseReleasePagesCached(
      releaseFamily,
      pages,
      incidentContext,
      followUpFocus,
    );
    const heading = followUpFocus
      ? `CPP ${releaseFamily} follow-up: ${followUpFocus.slice(0, 120)}`
      : `What changed in CPP ${releaseFamily}`;
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: rootMessage.ts,
      text: `*${heading}*\n${summary}\n\n*Sources*\n${formatSources(pages)}`,
      unfurl_links: false,
    });
    await addJiraComment?.(jiraId, {
      slackLink,
      name: "Slack Help Bot – release investigation",
      message: `*${heading}*\n${summary}\n\n*Sources*\n${formatJiraSources(pages)}`,
    });
  } catch (error) {
    console.error(
      `Unable to retrieve CPP ${releaseFamily} release notes:`,
      error.message,
    );
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: rootMessage.ts,
      text: `I couldn't retrieve the CPP ${releaseFamily} release notes. Check that the Confluence service token is configured and can read the Functional Releases pages.`,
    });
  }
  return true;
}

module.exports = {
  extractReleaseFamily,
  extractReleaseFollowUp,
  findRecentReleaseFamily,
  followUpWithReleaseNotes,
  formatSources,
  formatJiraSources,
};
