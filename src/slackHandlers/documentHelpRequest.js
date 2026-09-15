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
  SUBCATEGORY_ACTION_ID,
  SUBCATEGORY_BLOCK_ID,
  SUBCATEGORY_PENDING_ACTION_ID,
  HOW_ACTION_ID,
  HOW_BLOCK_ID,
  HOW_PENDING_ACTION_ID,
  HOW_PENDING_BLOCK_ID,
  createResolvePrivateMetadata,
  parseResolvePrivateMetadata,
  subcategoryInputBlock,
} = require("../messages/helpRequestResolve");

const config = require("config");
const { updateHelpRequestInCosmos } = require("../service/cosmos");
const { KNOWN_SUBCATEGORIES } = require("../analysis/resolutionTaxonomy");

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

function getSelectedSubCategoryFromView(view) {
  const subCategoryState = Object.entries(view.state.values).find(([blockId]) =>
    blockId.startsWith(SUBCATEGORY_BLOCK_ID),
  )?.[1];

  return (
    subCategoryState?.[SUBCATEGORY_ACTION_ID]?.selected_option ||
    subCategoryState?.[SUBCATEGORY_PENDING_ACTION_ID]?.selected_option
  );
}

function getDocumentationFromView(view) {
  const metadata = parseResolvePrivateMetadata(view.private_metadata);
  const selectedCategory = getSelectedCategoryFromView(view);
  const selectedSubCategory = getSelectedSubCategoryFromView(view);
  const howValue = getHowValueFromView(view);
  const category =
    selectedCategory?.text?.text ||
    metadata.suggestedCategoryLabel ||
    selectedCategory?.value ||
    metadata.suggestedCategory ||
    "Other";
  const requestedSubCategory =
    selectedSubCategory?.text?.text ||
    metadata.suggestedSubCategory ||
    selectedSubCategory?.value ||
    "Other";
  const subCategory = (KNOWN_SUBCATEGORIES[category] || ["Other"]).includes(
    requestedSubCategory,
  )
    ? requestedSubCategory
    : "Other";

  return {
    category,
    subCategory,
    how: howValue || metadata.suggestedResolution || "N/A",
  };
}

function getDocumentRequestKey({ area, threadTs }) {
  return `${area}:${threadTs}`;
}

function isHelpRequestAlreadyDone(blocks) {
  return blocks?.[2]?.fields?.[0]?.text?.includes("Done") === true;
}

async function updateResolutionSubcategories({ body, action, client }) {
  const category = action.selected_option?.text?.text;
  if (!category) {
    return;
  }

  const isPending = action.action_id === CATEGORY_PENDING_ACTION_ID;
  const metadata = parseResolvePrivateMetadata(body.view.private_metadata);
  const blocks = body.view.blocks.map((block) => {
    if (!block.block_id?.startsWith(SUBCATEGORY_BLOCK_ID)) return block;

    const subCategoryBlock = subcategoryInputBlock({ category, isPending });
    const categoryId = action.selected_option.value
      .replace(/[^a-z0-9]+/gi, "_")
      .toLowerCase();

    // Slack preserves input state when block_id and action_id are unchanged.
    // A category-specific block ID forces the subcategory select to refresh.
    subCategoryBlock.block_id = `${subCategoryBlock.block_id}_${categoryId}`;
    return subCategoryBlock;
  });

  await client.views.update({
    view_id: body.view.id,
    hash: body.view.hash,
    view: {
      type: "modal",
      callback_id: body.view.callback_id,
      title: body.view.title,
      submit: body.view.submit,
      ...(body.view.close ? { close: body.view.close } : {}),
      blocks,
      private_metadata: createResolvePrivateMetadata({
        threadTs: metadata.threadTs,
        suggestedCategory: action.selected_option.value,
        suggestedCategoryLabel: category,
        suggestedResolution: metadata.suggestedResolution,
      }),
    },
  });
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
    const documentation = getDocumentationFromView(body.view);
    const closedAt = new Date().toISOString();

    await resolveHelpRequest(jiraId);
    await addCommentToHelpRequestResolve(jiraId, documentation);
    await addLabel(jiraId, documentation);
    await updateHelpRequestInCosmos({
      key: jiraId,
      status: "Done",
      resolution: documentation.how,
      resolution_type: documentation.category,
      resolution_sub_type: documentation.subCategory,
      closed_at: closedAt,
    });

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

    await client.chat.postMessage({
      channel: area === "crime" ? reportChannelCrimeId : reportChannelId,
      thread_ts: metadata.threadTs,
      text: "Platform help request documented",
      blocks: helpRequestDocumentationBlocks(documentation),
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
module.exports.getSelectedSubCategoryFromView = getSelectedSubCategoryFromView;
module.exports.getDocumentRequestKey = getDocumentRequestKey;
module.exports.isHelpRequestAlreadyDone = isHelpRequestAlreadyDone;
module.exports.updateResolutionSubcategories = updateResolutionSubcategories;
