const { helpRequestResolveBlocks } = require("../messages");
const { classifyResolution, summariseResolutionHow } = require("../ai/ai");
const config = require("config");

const reportChannelId = config.get("slack.report_channel_id");
const reportChannelCrimeId = config.get("slack.report_channel_crime_id");

function extractBlockText(blocks) {
  if (!Array.isArray(blocks)) {
    return [];
  }

  const parts = [];

  blocks.forEach((block) => {
    const blockText = block?.text?.text;
    if (blockText) {
      parts.push(blockText);
    }

    if (Array.isArray(block?.fields)) {
      block.fields.forEach((field) => {
        if (field?.text) {
          parts.push(field.text);
        }
      });
    }

    if (Array.isArray(block?.elements)) {
      block.elements.forEach((element) => {
        if (typeof element?.text === "string") {
          parts.push(element.text);
          return;
        }

        if (element?.text?.text) {
          parts.push(element.text.text);
        }
      });
    }
  });

  return parts;
}

function buildResolutionContext(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { issueContext: [], resolutionComments: [] };
  }

  const issueContext = [];
  const resolutionComments = [];
  const requestDetailsMessages = messages.slice(0, 2);

  requestDetailsMessages.forEach((message) => {
    if (message?.text && message.text !== "New platform help request raised") {
      issueContext.push(message.text);
    }
    issueContext.push(...extractBlockText(message?.blocks));
  });

  messages.slice(2).forEach((message) => {
    if (message?.bot_id) {
      return;
    }

    if (message?.text === "Platform help request documented") {
      return;
    }

    if (message?.text) {
      resolutionComments.push(message.text);
    }
  });

  return {
    issueContext: issueContext
      .map((text) => text.trim())
      .filter((text) => text.length > 0),
    resolutionComments: resolutionComments
      .map((text) => text.trim())
      .filter((text) => text.length > 0),
  };
}

async function resolveHelpRequestHandler(client, body, area) {
  try {
    let suggestedCategory = null;
    let suggestedHow = null;
    let suggestedHowConfidence = null;
    let suggestedHowHint = null;

    // Fetch the thread to analyze for AI classification
    try {
      const helpRequestMessages = (
        await client.conversations.replies({
          channel: area === "crime" ? reportChannelCrimeId : reportChannelId,
          ts: body.message.ts,
          limit: 200,
        })
      ).messages;

      const resolutionContext = buildResolutionContext(helpRequestMessages);
      const classificationInput = [
        ...resolutionContext.issueContext,
        ...resolutionContext.resolutionComments,
      ];

      if (classificationInput.length > 0) {
        const classification = await classifyResolution(classificationInput);
        if (classification.category && classification.category !== "Unknown") {
          suggestedCategory = {
            category: classification.category,
            confidence: classification.confidence || "unknown",
          };
          console.log(
            `AI suggested category: ${classification.category} (confidence: ${classification.confidence})`,
          );
        }
      }

      if (resolutionContext.resolutionComments.length > 0) {
        const howSummary = await summariseResolutionHow({
          issueContext: resolutionContext.issueContext,
          resolutionComments: resolutionContext.resolutionComments,
        });
        if (howSummary?.summary && howSummary.summary.trim().length > 0) {
          suggestedHow = howSummary.summary.trim();
          suggestedHowConfidence = howSummary.confidence || "unknown";
        }
      } else {
        suggestedHowHint = "No resolution details available. Please add details.";
      }
    } catch (aiError) {
      console.error("Error during AI suggestions:", aiError);
      // Continue without AI suggestion if it fails
    }

    // Trigger IDs have a short lifespan, so process them first
    await client.views.open({
      trigger_id: body.trigger_id,
      view: helpRequestResolveBlocks({
        thread_ts: body.message.ts,
        area,
        suggestedCategory,
        suggestedHow,
        suggestedHowConfidence,
        suggestedHowHint,
      }),
    });
  } catch (error) {
    console.error(error);
  }
}

module.exports.resolveHelpRequestHandler = resolveHelpRequestHandler;
