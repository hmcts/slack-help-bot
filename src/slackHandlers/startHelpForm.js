const { helpFormMainBlocks } = require("../messages");
const { checkSlackResponseError } = require("./errorHandling");
const {
  helpGuidanceBlocks,
  helpGuidanceText,
} = require("../messages/helpGuidance");
const appInsights = require("../modules/appInsights");

async function updateLastMessage(client, body) {
  return await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: helpGuidanceText,
    blocks: helpGuidanceBlocks(),
  });
}

async function postHelpForm({
  client,
  channelId,
  userId,
  area,
  helpRequest,
  formSource,
}) {
  const postRes = await client.chat.postMessage({
    channel: channelId,
    text: "Raise a help request with Platform Operations",
    blocks: helpFormMainBlocks({
      user: userId,
      isAdvanced: false,
      area,
      helpRequest,
      formSource,
    }),
  });

  checkSlackResponseError(
    postRes,
    "An error occurred when posting a help request form",
  );

  appInsights.trackEvent("Help request form started");
}

async function startHelpForm(client, body) {
  try {
    const updateRes = await updateLastMessage(client, body);

    checkSlackResponseError(
      updateRes,
      "An error occurred when updating the help request prompt",
    );

    appInsights.trackEvent("Help guidance shown");
  } catch (error) {
    console.error(error);
  }
}

module.exports.startHelpForm = startHelpForm;
module.exports.postHelpForm = postHelpForm;
