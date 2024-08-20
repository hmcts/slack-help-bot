const { checkSlackResponseError } = require("./errorHandling");
const { helpFormGreetingBlocks } = require("../messages/helpFormGreeting");

const appInsights = require("../modules/appInsights");

async function sendMessage(client, channelId, ts, userId, area) {
  if (ts) {
    return await client.chat.update({
      channel: channelId,
      ts: ts,
      text: "Hello!",
      blocks: helpFormGreetingBlocks({
        user: userId,
        isAdvanced: false,
        area,
      }),
    });
  } else {
    return await client.chat.postMessage({
      channel: channelId,
      ts: ts,
      text: "Hello!",
      blocks: helpFormGreetingBlocks({
        user: userId,
        isAdvanced: false,
        area,
      }),
    });
  }
}

async function beginHelpRequest({ userId, client, area, ts }) {
  try {
    const openDmResponse = await client.conversations.open({
      users: userId,
      return_im: true,
    });

    const channelId = openDmResponse.channel.id;

    const postMessageResponse = await sendMessage(
      client,
      channelId,
      ts,
      userId,
      area,
    );

    checkSlackResponseError(
      postMessageResponse,
      "An error occurred when posting a direct message",
    );

    appInsights.trackEvent("Begin Help Request");
  } catch (error) {
    console.error(error);
  }
}

module.exports.beginHelpRequest = beginHelpRequest;
