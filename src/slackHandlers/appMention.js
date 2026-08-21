const { summariseThread } = require("../ai/ai");

const helpText = `
Available commands:
• \`help\` - List all available commands
• \`status-update <JIRA-KEY> <NEW-STATUS>\` - Update a ticket's status
• \`status <JIRA-KEY> <NEW-STATUS>\` - Shortcut for status-update
• \`duplicate <jira ticket id>\` - Mark a request as a duplicate
• \`summarise\` - AI summarizes all replies
• \`ticket-type [support|task]\` - Changes this ticket's Jira type

If you want to escalate a request please tag \`platformops-bau\`
`;

const config = require("config");
const {
  getIssueDescription,
  extractJiraIdFromBlocks,
  markAsDuplicate,
  updateHelpRequestType,
} = require("../service/persistence");
const { extractSlackLinkFromText } = require("../messages/util");
const { helpRequestDuplicateBlocks } = require("../messages");
const { lookupUsersName } = require("./utils/lookupUser");
const { updateHelpRequestInCosmos } = require("../service/cosmos");

/** @type {string} */
const reportChannelId = config.get("slack.report_channel_id");
/** @type {string} */
const reportChannelCrimeId = config.get("slack.report_channel_crime_id");

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

function updateTicketTypeDisplay(blocks, ticketType) {
  const updatedBlocks = structuredClone(blocks);
  const contextBlock = updatedBlocks.find((block) => block.type === "context");
  const ticketTypeElement = contextBlock?.elements?.find((element) =>
    element.text?.startsWith("Ticket type:"),
  );

  if (ticketTypeElement) {
    ticketTypeElement.text = `Ticket type: ${
      ticketType === "task" ? "Task" : "Support"
    }`;
  }

  return updatedBlocks;
}

async function handleTicketType({ event, client, helpRequestMessages, say }) {
  const blocks = helpRequestMessages[0].blocks;
  const currentIssueJiraId = extractJiraIdFromBlocks(blocks);

  const result = event.text.match(/ticket-type\s+(support|task)\b/i);
  if (!result) {
    await say({
      text: `Hi <@${event.user}>, use \`@PlatOps help ticket-type support\` or \`@PlatOps help ticket-type task\`.`,
      thread_ts: event.thread_ts,
    });
    return;
  }

  const ticketType = result[1].toLowerCase();

  try {
    await updateHelpRequestType(currentIssueJiraId, ticketType);

    await updateHelpRequestInCosmos({
      key: currentIssueJiraId,
      ticket_type: ticketType,
    });

    await client.chat.update({
      channel: event.channel,
      ts: helpRequestMessages[0].ts,
      text: "New platform help request raised",
      blocks: updateTicketTypeDisplay(blocks, ticketType),
    });

    await say({
      text: `Hi <@${event.user}>, this ticket is now a ${ticketType === "task" ? "Task" : "Support"}.`,
      thread_ts: event.thread_ts,
    });

    await client.reactions.add({
      name: "white_check_mark",
      timestamp: event.ts,
      channel: event.channel,
    });
  } catch (error) {
    console.error("Unable to change help request type", error);
    await say({
      text: `Hi <@${event.user}>, I couldn't change the Jira ticket type. Please check the Jira workflow and try again.`,
      thread_ts: event.thread_ts,
    });
  }
}

async function appMention(event, client, say) {
  try {
    // filter unwanted channels in case someone invites the bot to it
    // and only look at threaded messages
    if (
      (event.channel === reportChannelId ||
        event.channel === reportChannelCrimeId) &&
      event.thread_ts
    ) {
      const helpRequestResult = await client.conversations.replies({
        channel: event.channel,
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
        if (/ticket-type/i.test(event.text)) {
          await handleTicketType({
            event,
            client,
            helpRequestMessages,
            say,
          });
        } else if (event.text.includes("help")) {
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
module.exports.handleTicketType = handleTicketType;
module.exports.updateTicketTypeDisplay = updateTicketTypeDisplay;
