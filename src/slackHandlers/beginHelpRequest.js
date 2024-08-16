const { helpFormGreetingBlocks } = require("../messages");
const { checkSlackResponseError } = require("./errorHandling");

const appInsights = require("../modules/appInsights");

async function beginHelpRequest(userId, client) {
  try {
    const openDmResponse = await client.conversations.open({
      users: userId,
      return_im: true,
    });

    const channelId = openDmResponse.channel.id;

    const postMessageResponse = await client.chat.postMessage({
      channel: channelId,
      text: "Hello!",
      blocks: helpFormGreetingBlocks({
        user: userId,
        isAdvanced: false,
      }),
    });

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
