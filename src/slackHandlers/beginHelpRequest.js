const { checkSlackResponseError } = require("./errorHandling");
const { postHelpForm } = require("./startHelpForm");
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

async function beginHelpRequest({
  userId,
  client,
  area,
  ts,
  initialDescription,
}) {
  try {
    const openDmResponse = await client.conversations.open({
      users: userId,
      return_im: true,
    });

    const channelId = openDmResponse.channel.id;

    if (area && initialDescription) {
      await postHelpForm({
        client,
        channelId,
        userId,
        area,
        helpRequest: {
          description: initialDescription,
        },
        formSource: "knowledge_search",
      });

      appInsights.trackEvent("Begin Help Request");
      return;
    }

    const postMessageResponse = await sendHelpGuidanceMessage(
      client,
      channelId,
      ts,
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
