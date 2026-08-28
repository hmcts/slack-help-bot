const { helpRequestResolveBlocks } = require("../messages");
const { suggestResolutionDocumentation } = require("../ai/ai");
const config = require("config");

const reportChannelId = config.get("slack.report_channel_id");
const reportChannelCrimeId = config.get("slack.report_channel_crime_id");

function extractTextFromBlock(block) {
  const text = [];
  const readText = (textObject) => {
    if (typeof textObject === "string") {
      return textObject;
    }

    return textObject?.text;
  };

  const blockText = readText(block.text);
  if (blockText) {
    text.push(blockText);
  }

  if (block.fields) {
    text.push(...block.fields.map((field) => readText(field)).filter(Boolean));
  }

  if (block.elements) {
    text.push(
      ...block.elements
        .map((element) => readText(element.text))
        .filter(Boolean),
    );
  }

  return text.join("\n");
}

function extractTextFromMessage(message) {
  const blockText = (message.blocks || [])
    .map((block) => extractTextFromBlock(block))
    .filter((text) => text.length > 0)
    .join("\n");

  return [message.text, blockText].filter(Boolean).join("\n");
}

function extractThreadText(messages) {
  return messages
    .map((message) => extractTextFromMessage(message))
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
}

function toSuggestedCategory(suggestion) {
  if (!suggestion?.category) {
    return null;
  }

  const category =
    suggestion.category.trim().toLowerCase() === "unknown"
      ? "Other"
      : suggestion.category;

  return {
    category,
    subCategory: suggestion.subCategory || "Other",
    confidence: suggestion.confidence || "unknown",
  };
}

async function updateResolveModal({
  client,
  view,
  threadTs,
  area,
  suggestedCategory,
  suggestedResolution,
  isAiSuggestionLoading = false,
}) {
  await client.views.update({
    view_id: view.id,
    hash: view.hash,
    view: helpRequestResolveBlocks({
      thread_ts: threadTs,
      area,
      suggestedCategory,
      suggestedResolution,
      isAiSuggestionLoading,
    }),
  });
}

async function resolveHelpRequestHandler(client, body, area) {
  try {
    // Trigger IDs have a short lifespan, so process them first
    const openResult = await client.views.open({
      trigger_id: body.trigger_id,
      view: helpRequestResolveBlocks({
        thread_ts: body.message.ts,
        area,
        isAiSuggestionLoading: true,
      }),
    });

    try {
      const channel = area === "crime" ? reportChannelCrimeId : reportChannelId;
      const helpRequestResult = await client.conversations.replies({
        channel,
        ts: body.message.ts,
        limit: 200,
      });

      if (helpRequestResult.has_more === true) {
        console.log(
          "WARNING: Thread is longer than 200 messages, some messages may be missing from AI closure suggestion",
        );
      }

      const threadText = extractThreadText(helpRequestResult.messages || []);

      if (threadText.length === 0) {
        await updateResolveModal({
          client,
          view: openResult.view,
          threadTs: body.message.ts,
          area,
        });
        return;
      }

      const suggestion = await suggestResolutionDocumentation(threadText);
      const suggestedCategory = toSuggestedCategory(suggestion);

      if (suggestedCategory) {
        console.log(
          `AI suggested category: ${suggestedCategory.category} (confidence: ${suggestedCategory.confidence})`,
        );
      }

      await updateResolveModal({
        client,
        view: openResult.view,
        threadTs: body.message.ts,
        area,
        suggestedCategory,
        suggestedSubCategory: suggestedCategory?.subCategory,
        suggestedResolution: suggestion.resolutionSummary,
      });
    } catch (aiError) {
      console.error("Error during AI closure suggestion:", aiError);
      try {
        await updateResolveModal({
          client,
          view: openResult.view,
          threadTs: body.message.ts,
          area,
        });
      } catch (modalUpdateError) {
        console.error(
          "Error clearing AI closure suggestion loading state:",
          modalUpdateError,
        );
      }
      // Continue with the already-open modal if AI suggestions fail.
    }
  } catch (error) {
    console.error(error);
  }
}

module.exports.resolveHelpRequestHandler = resolveHelpRequestHandler;
module.exports.extractTextFromBlock = extractTextFromBlock;
module.exports.extractTextFromMessage = extractTextFromMessage;
module.exports.extractThreadText = extractThreadText;
module.exports.toSuggestedCategory = toSuggestedCategory;
module.exports.updateResolveModal = updateResolveModal;
