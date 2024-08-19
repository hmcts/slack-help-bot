const { summariseThread } = require("../ai/ai");

const helpText = `\`duplicate\ [JiraID]\` - Marks this ticket as a duplicate of the specified ID
\`summarise\` - Summarises the thread using AI

If you want to escalate a request please tag \`platformops-bau\`
`;

const config = require("config");
const {
  getIssueDescription,
  extractJiraIdFromBlocks,
  markAsDuplicate,
} = require("../service/persistence");
const { extractSlackLinkFromText } = require("../messages/util");
const { helpRequestDuplicateBlocks } = require("../messages");
const { lookupUsersName } = require("./utils/lookupUser");
const reportChannelId = config.get("slack.report_channel_id");

const feedback =
  "If this was useful, give me a :thumbsup: or if it wasn't then a :thumbsdown:";

async function extractReplies({ client, messages }) {
  return Promise.all(
    messages
      .filter((message) => {
        if (message.bot_id) {
          return false;
        }
        const messageText = message.text;
        return !(
          messageText.endsWith("summarise") ||
          messageText.endsWith("summarize") ||
          messageText.endsWith("summary")
        );
      })
      .map(async (message) => {
        const user = await lookupUsersName({ client, user: message.user });
        return `From: ${user}\nMessage: ${message.text}`;
      }),
  );
}

function extractSummaryFromBlocks(blocks) {
  return blocks[0].text.text;
}

async function handleDuplicate({ event, client, helpRequestMessages, say }) {
  // handle pasted text that is a link in the format of <https://tools.hmcts.net/jira/browse/SBOX-494|SBOX-494>
  // or <https://tools.hmcts.net/jira/browse/SBOX-494>
  const cleanedText = event.text
    .replace(/<https:.+\|/, "")
    .replace(/>/g, "")
    .replace("<https://tools.hmcts.net/jira/browse/", "");
  const result = cleanedText.match(/.+duplicate ([A-Z]+-[0-9]+)/);
  if (result) {
    const blocks = helpRequestMessages[0].blocks;
    const summary = extractSummaryFromBlocks(blocks);
    const parentJiraId = result[1];
    const issueDescription = await getIssueDescription(parentJiraId);

    if (issueDescription === undefined) {
      await say({
        text: `Hi <@${event.user}>, I couldn't find that Jira ID, please check and try again.`,
        thread_ts: event.thread_ts,
      });
      return;
    }
    const parentSlackUrl = extractSlackLinkFromText(issueDescription);
    const currentIssueJiraId = extractJiraIdFromBlocks(blocks);

    if (currentIssueJiraId === parentJiraId) {
      await say({
        text: `Hi <@${event.user}>, I can't mark an issue as a duplicate of itself.`,
        thread_ts: event.thread_ts,
      });
      return;
    }

    await markAsDuplicate(currentIssueJiraId, parentJiraId);

    await client.chat.update({
      channel: event.channel,
      ts: helpRequestMessages[0].ts,
      text: "Duplicate issue",
      blocks: helpRequestDuplicateBlocks({
        summary,
        parentJiraId,
        parentSlackUrl,
        currentIssueJiraId,
      }),
    });

    await client.reactions.add({
      name: "white_check_mark",
      timestamp: event.ts,
      channel: event.channel,
    });
  }
}

async function appMention(event, client, say) {
  try {
    // filter unwanted channels in case someone invites the bot to it
    // and only look at threaded messages
    if (event.channel === reportChannelId && event.thread_ts) {
      const helpRequestResult = await client.conversations.replies({
        channel: reportChannelId,
        ts: event.thread_ts,
        limit: 200, // after a thread is 200 long we'll break but good enough for now
      });

      if (helpRequestResult.has_more === true) {
        console.log(
          "WARNING: Thread is longer than 200 messages, some messages may be missing",
        );
      }

      const helpRequestMessages = helpRequestResult.messages;

      if (
        helpRequestMessages.length > 0 &&
        helpRequestMessages[0].text === "New platform help request raised"
      ) {
        if (event.text.includes("help")) {
          const usageMessage = `Hi <@${event.user}>, here is what I can do:

${helpText}`;

          await say({
            text: usageMessage,
            thread_ts: event.thread_ts,
          });
        } else if (event.text.includes("duplicate")) {
          await handleDuplicate({
            event,
            client,
            helpRequestMessages,
            say,
          });
        } else if (
          event.text.includes("summarise") ||
          event.text.includes("summarize") ||
          event.text.includes("summary")
        ) {
          await client.reactions.add({
            name: "eyes",
            timestamp: event.ts,
            channel: event.channel,
          });

          const messages = await extractReplies({
            client,
            messages: helpRequestMessages,
          });

          const summary = await summariseThread(messages);

          await say({
            text: `Hi <@${event.user}>, here is an AI Generated summary of the issue:\n\n${summary}\n\n_${feedback}_`,
            thread_ts: event.thread_ts,
          });

          await client.reactions.remove({
            name: "eyes",
            timestamp: event.ts,
            channel: event.channel,
          });
        } else {
          await say({
            text: `Hi <@${event.user}>, I didn't understand that. Here is what I can do:

${helpText}`,
            thread_ts: event.thread_ts,
          });
        }
      } else {
        await say({
          text: `Hi <@${event.user}>, here is what I can do:

${helpText}`,
          thread_ts: event.thread_ts,
        });
      }
    }
  } catch (error) {
    console.error(error);
  }
}

module.exports.appMention = appMention;
module.exports.feedback = feedback;
