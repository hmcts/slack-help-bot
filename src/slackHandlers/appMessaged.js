const { beginHelpRequest } = require("./beginHelpRequest");
const {
  extractJiraIdFromBlocks,
  addCommentToHelpRequest,
} = require("../service/persistence");
const { lookupUsersName, convertProfileToName } = require("./utils/lookupUser");
const config = require("config");

const reportChannelId = config.get("slack.report_channel_id");

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

async function appMessaged(event, context, client, say) {
  try {
    // Filters for direct(instant) messages
    if (event.channel_type === "im" && event.subtype !== "message_changed") {
      switch (event.text?.toLowerCase()) {
        case "help":
          // Open the PlatOps help request form. Alternative to the shortcut above
          await beginHelpRequest(context.userId, client);
          return;
        default:
          //
          await say(
            "Sorry, I didn't catch that. Here's what I can help you with:\n`help` Open a Platform Help Request",
          );
          return;
      }
    }

    // filter unwanted channels in case someone invites the bot to it
    // and only look at threaded messages
    if (event.channel !== reportChannelId) return;
    if (!event.thread_ts) return;

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
        channel: reportChannelId,
        ts: event.thread_ts,
        limit: 200, // after a thread is 200 long we'll break but good enough for now
      })
    ).messages;

    if (
      helpRequestMessages.length > 0 &&
      (helpRequestMessages[0].text === "New platform help request raised" ||
        helpRequestMessages[0].text === "Duplicate issue")
    ) {
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
