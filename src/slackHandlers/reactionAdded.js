const { feedback } = require("./appMention");
const appInsights = require("../modules/appInsights");

const positiveReactions = ["thumbsup", "+1"];
const negativeReactions = ["thumbsdown", "-1"];
const supportedReactions = [...positiveReactions, ...negativeReactions];

async function reactionAdded(event, client) {
  try {
    if (!supportedReactions.includes(event.reaction)) {
      return;
    }

    const result = await client.conversations.replies({
      channel: event.item.channel,
      ts: event.item.ts,
      limit: 1,
    });

    const message = result.messages[0];
    if (message.bot_profile && message.text.includes(feedback)) {
      const result = await client.bots.info({ bot: message.bot_profile.id });

      if (message.bot_profile.id === result.bot.id) {
        if (positiveReactions.includes(event.reaction)) {
          appInsights.trackEvent("Thread summary positive feedback");
        } else if (negativeReactions.includes(event.reaction)) {
          appInsights.trackEvent("Thread summary negative feedback");
        }
      }
    }
  } catch (err) {
    console.error(
      "Error when saving analytics information for a reaction",
      err,
    );
  }
}

module.exports.reactionAdded = reactionAdded;
