const { helpRequestResolveBlocks } = require("../messages");

async function resolveHelpRequestHandler(client, body) {
  try {
    // Trigger IDs have a short lifespan, so process them first
    await client.views.open({
      trigger_id: body.trigger_id,
      view: helpRequestResolveBlocks({ thread_ts: body.message.ts }),
    });
  } catch (error) {
    console.error(error);
  }
}

module.exports.resolveHelpRequestHandler = resolveHelpRequestHandler;
