const {
  helpFormMainBlocks,
  helpFormPlatoBlocks,
  helpFormGreetingBlocks,
} = require("../messages");
const { checkSlackResponseError } = require("./errorHandling");
const appInsights = require("../modules/appInsights");

async function updateLastMessage(client, body, area) {
  if (area === "other") {
    return await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "Chat to Plato",
      blocks: helpFormPlatoBlocks({
        user: body.user.id,
        isAdvanced: true,
      }),
    });
  } else {
    return await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "Hello!",
      blocks: helpFormGreetingBlocks({
        user: body.user.id,
        area,
        isAdvanced: true,
      }),
    });
  }
}

async function startHelpForm(client, body, area) {
  try {
    // Post Ticket raising form
    const postRes = await client.chat.postMessage({
      channel: body.channel.id,
      text: "Raise a help request with Platform Operations",
      blocks: helpFormMainBlocks({
        user: body.user.id,
        isAdvanced: false,
        area,
      }),
    });

    checkSlackResponseError(
      postRes,
      "An error occurred when posting a help request form",
    );

    // Edit button from last message
    const updateRes = await updateLastMessage(client, body, area);

    checkSlackResponseError(
      updateRes,
      "An error occurred when updating a 'Chat to Plato' message",
    );

    appInsights.trackEvent("Plato couldn't help");
  } catch (error) {
    console.error(error);
  }
}

module.exports.startHelpForm = startHelpForm;
