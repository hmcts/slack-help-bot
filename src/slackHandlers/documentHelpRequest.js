const {
  extractJiraIdFromBlocks,
  resolveHelpRequest,
  addCommentToHelpRequestResolve,
  addLabel,
} = require("../service/persistence");
const { helpRequestDocumentationBlocks } = require("../messages");
const {
  CATEGORY_ACTION_ID,
  CATEGORY_BLOCK_ID,
  CATEGORY_PENDING_ACTION_ID,
  CATEGORY_PENDING_BLOCK_ID,
  HOW_ACTION_ID,
  HOW_BLOCK_ID,
  HOW_PENDING_ACTION_ID,
  HOW_PENDING_BLOCK_ID,
  parseResolvePrivateMetadata,
} = require("../messages/helpRequestResolve");

const config = require("config");
const { updateCosmosWhenHelpRequestResolved } = require("../service/cosmos");

/** @type {string} */
const reportChannelId = config.get("slack.report_channel_id");
/** @type {string} */
const reportChannelCrimeId = config.get("slack.report_channel_crime_id");
const activeDocumentRequests = new Set();

function getViewStateValue(view, blockId, actionId) {
  return view.state.values[blockId]?.[actionId];
}

function getSelectedCategoryFromView(view) {
  return (
    getViewStateValue(view, CATEGORY_BLOCK_ID, CATEGORY_ACTION_ID)
      ?.selected_option ||
    getViewStateValue(
      view,
      CATEGORY_PENDING_BLOCK_ID,
      CATEGORY_PENDING_ACTION_ID,
    )?.selected_option
  );
}

function getHowValueFromView(view) {
  return (
    getViewStateValue(view, HOW_BLOCK_ID, HOW_ACTION_ID)?.value ||
    getViewStateValue(view, HOW_PENDING_BLOCK_ID, HOW_PENDING_ACTION_ID)?.value
  );
}

function getDocumentationFromView(view) {
  const metadata = parseResolvePrivateMetadata(view.private_metadata);
  const selectedCategory = getSelectedCategoryFromView(view);
  const howValue = getHowValueFromView(view);

  return {
    category:
      selectedCategory?.text?.text ||
      metadata.suggestedCategoryLabel ||
      selectedCategory?.value ||
      metadata.suggestedCategory ||
      "unknown",
    how: howValue || metadata.suggestedResolution || "N/A",
  };
}

function getDocumentRequestKey({ area, threadTs }) {
  return `${area}:${threadTs}`;
}

function isHelpRequestAlreadyDone(blocks) {
  return blocks?.[2]?.fields?.[0]?.text?.includes("Done") === true;
}

async function documentHelpRequest(client, body, area) {
  const metadata = parseResolvePrivateMetadata(body.view.private_metadata);
  const documentRequestKey = getDocumentRequestKey({
    area,
    threadTs: metadata.threadTs,
  });

  if (activeDocumentRequests.has(documentRequestKey)) {
    console.log("Skipping duplicate help request documentation submission");
    return;
  }

  activeDocumentRequests.add(documentRequestKey);

  try {
    const helpRequestMessages = (
      await client.conversations.replies({
        channel: area === "crime" ? reportChannelCrimeId : reportChannelId,
        ts: metadata.threadTs,
        limit: 200, // after a thread is 200 long we'll break but good enough for now
      })
    ).messages;

    if (isHelpRequestAlreadyDone(helpRequestMessages[0]?.blocks)) {
      console.log("Skipping already documented help request");
      return;
    }

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
      channel: area === "crime" ? reportChannelCrimeId : reportChannelId,
      ts: metadata.threadTs,
      text: "New platform help request raised",
      blocks: blocks,
    });

    const documentation = getDocumentationFromView(body.view);

    await addCommentToHelpRequestResolve(jiraId, documentation);

    await addLabel(jiraId, documentation);

    await client.chat.postMessage({
      channel: area === "crime" ? reportChannelCrimeId : reportChannelId,
      thread_ts: metadata.threadTs,
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
  } finally {
    activeDocumentRequests.delete(documentRequestKey);
  }
}

module.exports.documentHelpRequest = documentHelpRequest;
module.exports.getDocumentationFromView = getDocumentationFromView;
module.exports.getSelectedCategoryFromView = getSelectedCategoryFromView;
module.exports.getHowValueFromView = getHowValueFromView;
module.exports.getDocumentRequestKey = getDocumentRequestKey;
module.exports.isHelpRequestAlreadyDone = isHelpRequestAlreadyDone;
