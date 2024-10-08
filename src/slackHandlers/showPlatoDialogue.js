const { helpFormPlatoBlocks, helpFormGreetingBlocks } = require("../messages");
const { checkSlackResponseError } = require("./errorHandling");

async function showPlatoDialogue(client, body) {
  try {
    // Post 'Talk to Plato' message
    const postRes = await client.chat.postMessage({
      channel: body.channel.id,
      text: "Chat to Plato",
      blocks: helpFormPlatoBlocks({
        user: body.user.id,
        isAdvanced: false,
      }),
    });

    checkSlackResponseError(
      postRes,
      "An error occurred when posting a 'Chat to Plato' message",
    );

    // Edit button from last message
    const updateRes = await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "Hello!",
      blocks: helpFormGreetingBlocks({
        user: body.user.id,
        // plato only for non crime for now
        area: "other",
        isAdvanced: true,
      }),
    });

    checkSlackResponseError(
      updateRes,
      "An error occurred when updating a greeting message",
    );
  } catch (error) {
    console.error(error);
  }
}

module.exports.showPlatoDialogue = showPlatoDialogue;
