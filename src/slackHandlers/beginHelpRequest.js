const { checkSlackResponseError } = require("./errorHandling");
const {
  helpGuidanceBlocks,
  helpGuidanceText,
} = require("../messages/helpGuidance");

const appInsights = require("../modules/appInsights");

async function sendHelpGuidanceMessage(client, channelId, ts) {
  const message = {
    channel: channelId,
    text: helpGuidanceText,
    blocks: helpGuidanceBlocks(),
  };

  if (ts) {
    return await client.chat.update({
      ...message,
      ts,
    });
  }

  return await client.chat.postMessage(message);
}

async function beginHelpRequest({ userId, client }) {
  try {
    const openDmResponse = await client.conversations.open({
      users: userId,
      return_im: true,
    });

    const channelId = openDmResponse.channel.id;

    const postMessageResponse = await sendHelpGuidanceMessage(
      client,
      channelId,
    );

    checkSlackResponseError(
      postMessageResponse,
      "An error occurred when posting a direct message",
    );

    appInsights.trackEvent("Help guidance shown");
  } catch (error) {
    console.error(error);
  }
}

module.exports.beginHelpRequest = beginHelpRequest;
module.exports.sendHelpGuidanceMessage = sendHelpGuidanceMessage;
