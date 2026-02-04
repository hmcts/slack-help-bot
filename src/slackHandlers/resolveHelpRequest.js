const { helpRequestResolveBlocks } = require("../messages");
const { classifyResolution } = require("../ai/ai");
const config = require("config");

const reportChannelId = config.get("slack.report_channel_id");
const reportChannelCrimeId = config.get("slack.report_channel_crime_id");

async function resolveHelpRequestHandler(client, body, area) {
  try {
    let suggestedCategory = null;

    // Fetch the thread to analyze for AI classification
    try {
      const helpRequestMessages = (
        await client.conversations.replies({
          channel: area === "crime" ? reportChannelCrimeId : reportChannelId,
          ts: body.message.ts,
          limit: 200,
        })
      ).messages;

      // Extract text from messages for AI analysis
      const threadText = helpRequestMessages
        .map((msg) => msg.text || "")
        .filter((text) => text.length > 0);

      if (threadText.length > 0) {
        const classification = await classifyResolution(threadText);
        if (
          classification.category &&
          classification.category !== "Unknown"
        ) {
          suggestedCategory = {
            category: classification.category,
            confidence: classification.confidence || "unknown",
          };
          console.log(
            `AI suggested category: ${classification.category} (confidence: ${classification.confidence})`,
          );
        }
      }
    } catch (aiError) {
      console.error("Error during AI classification:", aiError);
      // Continue without AI suggestion if it fails
    }

    // Trigger IDs have a short lifespan, so process them first
    await client.views.open({
      trigger_id: body.trigger_id,
      view: helpRequestResolveBlocks({
        thread_ts: body.message.ts,
        area,
        suggestedCategory,
      }),
    });
  } catch (error) {
    console.error(error);
  }
}

module.exports.resolveHelpRequestHandler = resolveHelpRequestHandler;
