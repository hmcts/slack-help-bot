const { optionBlock } = require("./util");
const {
  RESOLUTION_CATEGORIES,
  KNOWN_SUBCATEGORIES,
} = require("../analysis/resolutionTaxonomy");

const CATEGORY_BLOCK_ID = "category_block";
const CATEGORY_ACTION_ID = "category";
const SUBCATEGORY_BLOCK_ID = "subcategory_block";
const SUBCATEGORY_ACTION_ID = "subcategory";
const SUBCATEGORY_PENDING_BLOCK_ID = "subcategory_block_pending";
const SUBCATEGORY_PENDING_ACTION_ID = "subcategory_pending";
const HOW_BLOCK_ID = "how_block";
const HOW_ACTION_ID = "how";
const CATEGORY_PENDING_BLOCK_ID = "category_block_pending";
const CATEGORY_PENDING_ACTION_ID = "category_pending";
const HOW_PENDING_BLOCK_ID = "how_block_pending";
const HOW_PENDING_ACTION_ID = "how_pending";

function getResolutionCategories(area) {
  const commonCategories = RESOLUTION_CATEGORIES.filter(
    (category) => category !== "Release Support",
  ).map((category) => optionBlock(category));

  if (area === "crime") {
    return RESOLUTION_CATEGORIES.map((category) => optionBlock(category));
  }

  return commonCategories;
}

function createResolvePrivateMetadata({
  threadTs,
  suggestedCategory,
  suggestedCategoryLabel,
  suggestedSubCategory,
  suggestedResolution,
}) {
  if (!suggestedCategory && !suggestedResolution) {
    return `${threadTs}`;
  }

  const metadata = {
    thread_ts: `${threadTs}`,
  };

  if (suggestedCategory) {
    metadata.suggested_category = suggestedCategory;
  }

  if (suggestedCategoryLabel) {
    metadata.suggested_category_label = suggestedCategoryLabel;
  }

  if (suggestedSubCategory) {
    metadata.suggested_sub_category = suggestedSubCategory;
  }

  if (suggestedResolution) {
    metadata.suggested_resolution = suggestedResolution;
  }

  return JSON.stringify(metadata);
}

function parseResolvePrivateMetadata(privateMetadata) {
  try {
    const parsed = JSON.parse(privateMetadata);

    if (!parsed || typeof parsed !== "object") {
      return {
        threadTs: privateMetadata,
      };
    }

    const metadata = {
      threadTs: parsed.thread_ts || privateMetadata,
    };

    if (parsed.suggested_category) {
      metadata.suggestedCategory = parsed.suggested_category;
    }

    if (parsed.suggested_category_label) {
      metadata.suggestedCategoryLabel = parsed.suggested_category_label;
    }

    if (parsed.suggested_sub_category) {
      metadata.suggestedSubCategory = parsed.suggested_sub_category;
    }

    if (parsed.suggested_resolution) {
      metadata.suggestedResolution = parsed.suggested_resolution;
    }

    return metadata;
  } catch {
    return {
      threadTs: privateMetadata,
    };
  }
}

function findResolutionCategoryOption(resolutionCategories, suggestedCategory) {
  if (!suggestedCategory) {
    return undefined;
  }

  const normalizedCategory = suggestedCategory.category.toLowerCase();

  return resolutionCategories.find(
    (opt) =>
      opt.value === normalizedCategory ||
      opt.text.text.toLowerCase() === normalizedCategory,
  );
}

function categoryInputBlock({
  resolutionCategories,
  suggestedCategory,
  suggestedCategoryOption,
  isPending,
}) {
  return {
    type: "input",
    block_id: isPending ? CATEGORY_PENDING_BLOCK_ID : CATEGORY_BLOCK_ID,
    element: {
      type: "static_select",
      placeholder: {
        type: "plain_text",
        text: "Select an item",
        emoji: true,
      },
      options: resolutionCategories,
      ...(suggestedCategoryOption && {
        initial_option: suggestedCategoryOption,
      }),
      action_id: isPending ? CATEGORY_PENDING_ACTION_ID : CATEGORY_ACTION_ID,
    },
    label: {
      type: "plain_text",
      text: suggestedCategory
        ? `What was the issue? :robot_face: (AI suggested - ${
            suggestedCategory.confidence || "unknown"
          } confidence)`
        : "What was the issue?",
      emoji: true,
    },
  };
}

function subcategoryInputBlock({ suggestedSubCategory, isPending }) {
  const options = [...new Set(Object.values(KNOWN_SUBCATEGORIES).flat())].map(
    (subcategory) => optionBlock(subcategory),
  );
  const initialOption = options.find(
    (option) =>
      suggestedSubCategory &&
      option.text.text.toLowerCase() === suggestedSubCategory.toLowerCase(),
  );

  return {
    type: "input",
    block_id: isPending ? SUBCATEGORY_PENDING_BLOCK_ID : SUBCATEGORY_BLOCK_ID,
    element: {
      type: "static_select",
      placeholder: { type: "plain_text", text: "Select an item", emoji: true },
      options,
      ...(initialOption && { initial_option: initialOption }),
      action_id: isPending
        ? SUBCATEGORY_PENDING_ACTION_ID
        : SUBCATEGORY_ACTION_ID,
    },
    label: {
      type: "plain_text",
      text: "Which platform or sub-category?",
      emoji: true,
    },
    optional: true,
  };
}

function aiSuggestionLoadingBlock() {
  return {
    type: "context",
    block_id: "ai_suggestion_loading_block",
    elements: [
      {
        type: "mrkdwn",
        text: ":hourglass_flowing_sand: AI is preparing suggested closure details.",
      },
    ],
  };
}

function howInputBlock({ suggestedResolution, isPending }) {
  return {
    type: "input",
    block_id: isPending ? HOW_PENDING_BLOCK_ID : HOW_BLOCK_ID,
    element: {
      type: "plain_text_input",
      action_id: isPending ? HOW_PENDING_ACTION_ID : HOW_ACTION_ID,
      multiline: true,
      placeholder: {
        type: "plain_text",
        text: "Provide some details?",
      },
      ...(suggestedResolution && {
        initial_value: suggestedResolution,
      }),
    },
    label: {
      type: "plain_text",
      text: suggestedResolution
        ? ":bulb: How?\n (AI suggested - edit before documenting)"
        : ":bulb: How?\n (Provide some details)",
    },
    optional: true,
  };
}

function helpRequestResolveBlocks({
  thread_ts,
  area,
  suggestedCategory,
  suggestedSubCategory,
  suggestedResolution,
  isAiSuggestionLoading = false,
}) {
  const resolutionCategories = getResolutionCategories(area);
  const suggestedCategoryOption = findResolutionCategoryOption(
    resolutionCategories,
    suggestedCategory,
  );
  const isPending = isAiSuggestionLoading;

  return {
    title: {
      type: "plain_text",
      text: "Document Help Request",
    },
    submit: {
      type: "plain_text",
      text: "Document",
    },
    blocks: [
      {
        type: "section",
        block_id: "title_block",
        text: {
          type: "mrkdwn",
          text: "*Run into this problem often?*",
        },
      },
      {
        type: "section",
        block_id: "subtitle_block",
        text: {
          type: "plain_text",
          text: "Write some documentation to help out next time!\nKeep answers brief, but make them informative.",
          emoji: true,
        },
      },
      {
        type: "section",
        block_id: "doc_block",
        text: {
          type: "plain_text",
          text: "Please reference ops-runbook for explanation details on the resolution categories:",
          emoji: true,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "<https://hmcts.github.io/ops-runbooks/BAU-Live-Services/platops-help-request.html#resolve-a-platops-bau-ticket>",
          },
        ],
      },
      categoryInputBlock({
        resolutionCategories,
        suggestedCategory,
        suggestedCategoryOption,
        isPending,
      }),
      subcategoryInputBlock({ suggestedSubCategory, isPending }),
      ...(isAiSuggestionLoading ? [aiSuggestionLoadingBlock()] : []),
      howInputBlock({ suggestedResolution, isPending }),
    ],
    type: "modal",
    callback_id: `document_help_request${area === "crime" ? "_crime" : ""}`,
    // We use the private_metadata field to smuggle the ts of the thread
    // into the form so the bot knows where to reply when the form is submitted
    private_metadata: createResolvePrivateMetadata({
      threadTs: thread_ts,
      suggestedCategory: suggestedCategoryOption?.value,
      suggestedCategoryLabel: suggestedCategoryOption?.text.text,
      suggestedSubCategory,
      suggestedResolution,
    }),
  };
}

module.exports.helpRequestResolveBlocks = helpRequestResolveBlocks;
module.exports.getResolutionCategories = getResolutionCategories;
module.exports.createResolvePrivateMetadata = createResolvePrivateMetadata;
module.exports.parseResolvePrivateMetadata = parseResolvePrivateMetadata;
module.exports.findResolutionCategoryOption = findResolutionCategoryOption;
module.exports.CATEGORY_BLOCK_ID = CATEGORY_BLOCK_ID;
module.exports.CATEGORY_ACTION_ID = CATEGORY_ACTION_ID;
module.exports.SUBCATEGORY_BLOCK_ID = SUBCATEGORY_BLOCK_ID;
module.exports.SUBCATEGORY_ACTION_ID = SUBCATEGORY_ACTION_ID;
module.exports.SUBCATEGORY_PENDING_BLOCK_ID = SUBCATEGORY_PENDING_BLOCK_ID;
module.exports.SUBCATEGORY_PENDING_ACTION_ID = SUBCATEGORY_PENDING_ACTION_ID;
module.exports.HOW_BLOCK_ID = HOW_BLOCK_ID;
module.exports.HOW_ACTION_ID = HOW_ACTION_ID;
module.exports.CATEGORY_PENDING_BLOCK_ID = CATEGORY_PENDING_BLOCK_ID;
module.exports.CATEGORY_PENDING_ACTION_ID = CATEGORY_PENDING_ACTION_ID;
module.exports.HOW_PENDING_BLOCK_ID = HOW_PENDING_BLOCK_ID;
module.exports.HOW_PENDING_ACTION_ID = HOW_PENDING_ACTION_ID;
