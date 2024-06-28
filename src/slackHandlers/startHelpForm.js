const { helpFormMainBlocks, helpFormPlatoBlocks } = require("../messages");
const { checkSlackResponseError } = require("./errorHandling");

async function startHelpForm(client, body) {
  try {
    // Post Ticket raising form
    const postRes = await client.chat.postMessage({
      channel: body.channel.id,
      text: "Raise a Ticket With PlatOps",
      blocks: helpFormMainBlocks({
        user: body.user.id,
        isAdvanced: false,
      }),
    });

    checkSlackResponseError(
      postRes,
      "An error occurred when posting a help request form",
    );

    // Edit button from last message
    const updateRes = await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "Chat to Plato",
      blocks: helpFormPlatoBlocks({
        user: body.user.id,
        isAdvanced: true,
      }),
    });

    checkSlackResponseError(
      updateRes,
      "An error occurred when updating a 'Chat to Plato' message",
    );
  } catch (error) {
    console.error(error);
  }
}

module.exports.startHelpForm = startHelpForm;
