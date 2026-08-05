const { beginHelpRequest } = require("./beginHelpRequest");
const {
  knowledgeSearchPromptBlocks,
} = require("../messages/knowledgeSearchPrompt");
const { setPendingKnowledgeSearch } = require("./utils/pendingKnowledgeSearch");
const {
  extractJiraIdFromBlocks,
  addCommentToHelpRequest,
} = require("../service/persistence");
const { lookupUsersName, convertProfileToName } = require("./utils/lookupUser");
const config = require("config");
const { notifyThreadWatchers } = require("./watchHelpRequestThread");

/** @type {string} */
const reportChannelId = config.get("slack.report_channel_id");
/** @type {string} */
const reportChannelCrimeId = config.get("slack.report_channel_crime_id");

/**
 * The built-in string replace function can't return a promise
 * This is an adapted version that is able to do that
 * Source: https://stackoverflow.com/a/48032528/4951015
 *
 * @param str source string
 * @param regex the regex to apply to the string
 * @param asyncFn function to transform the string with, arguments should include match and any capturing groups
 * @returns {Promise<*>} result of the replace
 */
async function replaceAsync(str, regex, asyncFn) {
  const promises = [];
  str.replace(regex, (match, ...args) => {
    const promise = asyncFn(match, ...args);
    promises.push(promise);
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift());
}

async function promptForKnowledgeSearchPlatform(event, say) {
  const question = event.text.trim();
  setPendingKnowledgeSearch({
    channelId: event.channel,
    userId: event.user,
    question,
  });

  await say({
    text: "Which platform should I search?",
    blocks: knowledgeSearchPromptBlocks(),
  });
}

async function appMessaged(event, context, client, say) {
  try {
    if (event.bot_id || event.subtype === "message_changed") {
      return;
    }

    // Filters for direct(instant) messages
    if (event.channel_type === "im") {
      const text = event.text?.trim();

      if (!text) {
        return;
      }

      switch (text.toLowerCase()) {
        case "help":
          // Open the PlatOps help request form. Alternative to the shortcut above
          await beginHelpRequest({ userId: context.userId, client });
          return;
        default:
          await promptForKnowledgeSearchPlatform(event, say);
          return;
      }
    }

    // filter unwanted channels in case someone invites the bot to it
    // and only look at threaded messages
    if (
      event.channel !== reportChannelId &&
      event.channel !== reportChannelCrimeId
    )
      return;
    if (!event.thread_ts) {
      return;
    }

    // The code below here monitors the thread of any help request and
    // automatically mirrors the messages to the Jira ticket.

    const slackLink = (
      await client.chat.getPermalink({
        channel: event.channel,
        message_ts: event.thread_ts,
      })
    ).permalink;

    const name = await lookupUsersName({ user: event.user, client });

    // Should be able to get root message using timestamp
    const helpRequestMessages = (
      await client.conversations.replies({
        channel: event.channel,
        ts: event.thread_ts,
        limit: 200, // after a thread is 200 long we'll break but good enough for now
      })
    ).messages;

    if (
      helpRequestMessages.length > 0 &&
      (helpRequestMessages[0].text === "New platform help request raised" ||
        helpRequestMessages[0].text === "Duplicate issue")
    ) {
      await notifyThreadWatchers({
        event,
        rootMessage: helpRequestMessages[0],
        client,
      });

      const jiraId = extractJiraIdFromBlocks(helpRequestMessages[0].blocks);

      const groupRegex = /<!subteam\^.+\|([^>.]+)>/g;
      const usernameRegex = /<@([^>.]+)>/g;

      let possibleNewTargetText = event.text.replace(
        groupRegex,
        (match, $1) => $1,
      );

      const newTargetText = await replaceAsync(
        possibleNewTargetText,
        usernameRegex,
        async (match, $1) => {
          const user = await client.users.profile.get({
            user: $1,
          });
          return `@${convertProfileToName(user.profile)}`;
        },
      );

      await addCommentToHelpRequest(jiraId, {
        slackLink,
        name,
        message: newTargetText,
      });
    } else {
      // either need to implement pagination or find a better way to get the first message in the thread
      console.warn(
        "Could not find jira ID, possibly thread is longer than 200 messages, TODO implement pagination",
      );
    }
  } catch (error) {
    console.error(error);
  }
}

module.exports.appMessaged = appMessaged;
module.exports.promptForKnowledgeSearchPlatform =
  promptForKnowledgeSearchPlatform;
