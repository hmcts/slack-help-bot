const { summariseThread, answerQuestion } = require("../ai/ai");

const helpText = `\`duplicate\ [JiraID]\` - Marks this ticket as a duplicate of the specified ID
\`summarise\` - Summarises the thread using AI
\`question\` [text] - Ask a question about this thread

If you want to escalate a request please tag \`platformops-bau\`
`;

const config = require("config");
const {
  getIssueDescription,
  extractJiraIdFromBlocks,
  markAsDuplicate,
} = require("../service/persistence");
const {
  convertJiraKeyToUrl,
  convertStoragePathToHmctsWayUrl,
  extractKnowledgeStoreHighlight,
  extractSlackLinkFromText,
  stringTrim,
} = require("../messages/util");
const { helpRequestDuplicateBlocks } = require("../messages");
const { lookupUsersName } = require("./utils/lookupUser");
const { searchHelpRequestsForQuestion } = require("../service/searchHelpRequests");
const { searchKnowledgeStore } = require("../service/searchKnowledgeStore");

/** @type {string} */
const reportChannelId = config.get("slack.report_channel_id");
/** @type {string} */
const reportChannelCrimeId = config.get("slack.report_channel_crime_id");

const feedback =
  "If this was useful, give me a :thumbsup: or if it wasn't then a :thumbsdown:";

function extractMentionId(text) {
  if (!text) {
    return null;
  }
  const match = text.match(/<@([A-Z0-9]+)>/);
  return match ? match[1] : null;
}

function stripMentions(text, mentionId) {
  if (!text) {
    return "";
  }
  if (mentionId) {
    return text.replace(new RegExp(`<@${mentionId}>`, "g"), "").trim();
  }
  return text.replace(/<@[^>]+>/g, "").trim();
}

function parseCommandFromText(text, mentionId) {
  const withoutMentions = stripMentions(text, mentionId);
  if (!withoutMentions) {
    return { command: null, argsText: "" };
  }
  const [command, ...rest] = withoutMentions.split(/\s+/);
  return {
    command: command.toLowerCase(),
    argsText: rest.join(" ").trim(),
  };
}

function normaliseCommand(command) {
  if (!command) {
    return null;
  }
  if (command === "summarize" || command === "summary") {
    return "summarise";
  }
  return command;
}

async function extractReplies({
  client,
  messages,
  mentionId,
  excludedCommands = [],
  includeBots = false,
}) {
  return Promise.all(
    messages
      .filter((message) => {
        if (message.bot_id && !includeBots) {
          return false;
        }
        if (!message.text) {
          return false;
        }
        if (mentionId) {
          const parsed = parseCommandFromText(message.text, mentionId);
          const command = normaliseCommand(parsed.command);
          if (command && excludedCommands.includes(command)) {
            return false;
          }
        }
        return true;
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

function formatHmctsWaySources(results) {
  return results.map((item) => {
    return {
      title: item.document.title,
      url: convertStoragePathToHmctsWayUrl(item.document.metadata_storage_path),
      highlight: extractKnowledgeStoreHighlight(item),
    };
  });
}

function formatPastTicketSources(results) {
  return results.map((issue) => {
    const snippetSource = (
      issue.resolution ||
      issue.analysis ||
      issue.description ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
    return {
      key: issue.key,
      title: issue.title,
      snippet: stringTrim(snippetSource, 300, "..."),
      slackUrl: issue.url,
      jiraUrl: convertJiraKeyToUrl(issue.key),
    };
  });
}

function buildHmctsWaySection(hmctsWaySources) {
  if (hmctsWaySources.length === 0) {
    return "";
  }
  const lines = hmctsWaySources.map((source, index) => {
    return `- **HMCTS_WAY_${index + 1}**: <${source.url}|${source.title}>\n  _Matched content:_ ${source.highlight}`;
  });
  return `\n\n---\n*Documentation:*\n${lines.join("\n\n")}`;
}

function buildPastTicketsSection(pastTickets) {
  if (pastTickets.length === 0) {
    return "";
  }
  const lines = pastTickets.map((ticket, index) => {
    const links = [
      ticket.jiraUrl ? `<${ticket.jiraUrl}|${ticket.key}>` : ticket.key,
      ticket.slackUrl ? `<${ticket.slackUrl}|Slack thread>` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    return `- **TICKET_${index + 1}**: ${links} - ${ticket.title}\n  _Matched content:_ ${ticket.snippet}`;
  });
  return `\n\n---\n*Similar past tickets:*\n${lines.join("\n\n")}`;
}

async function handleQuestion({
  event,
  client,
  helpRequestMessages,
  say,
  area,
  mentionId,
  questionText,
}) {
  if (!questionText) {
    await say({
      text: `Hi <@${event.user}>, please provide a question after the \`question\` command.`,
      thread_ts: event.thread_ts,
    });
    return;
  }

  console.log(`Question command: area=${area}, channel=${event.channel}`);

  await client.reactions.add({
    name: "eyes",
    timestamp: event.ts,
    channel: event.channel,
  });

  const threadMessages = await extractReplies({
    client,
    messages: helpRequestMessages,
    mentionId,
    excludedCommands: ["summarise", "question"],
    includeBots: true,
  });

  const [knowledgeStoreResults, pastTicketsResults] = await Promise.all([
    searchKnowledgeStore(questionText, area),
    searchHelpRequestsForQuestion(questionText, area),
  ]);

  console.log(
    `Search results: HMCTS Way=${knowledgeStoreResults.length}, Past tickets=${pastTicketsResults.length}`,
  );

  const hmctsWaySources = formatHmctsWaySources(knowledgeStoreResults);
  const pastTickets = formatPastTicketSources(pastTicketsResults);

  const answer = await answerQuestion({
    question: questionText,
    threadMessages,
    hmctsWaySources,
    pastTickets,
  });

  const hmctsWaySection = buildHmctsWaySection(hmctsWaySources);
  const pastTicketsSection = buildPastTicketsSection(pastTickets);

  await say({
    text: `Hi <@${event.user}>, ${answer}${hmctsWaySection}${pastTicketsSection}\n\n_${feedback}_`,
    thread_ts: event.thread_ts,
  });

  await client.reactions.remove({
    name: "eyes",
    timestamp: event.ts,
    channel: event.channel,
  });
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
      const area = "other"; // HARDCODED FOR TESTING - was: event.channel === reportChannelCrimeId ? "crime" : "other";
      console.log(
        `appMention: channel=${event.channel}, area=${area}, isCrime=${event.channel === reportChannelCrimeId}`,
      );
      const mentionId = extractMentionId(event.text);
      const parsedCommand = parseCommandFromText(event.text, mentionId);
      const command = normaliseCommand(parsedCommand.command);

      if (
        helpRequestMessages.length > 0 &&
        helpRequestMessages[0].text === "New platform help request raised"
      ) {
        if (!command || command === "help") {
          const usageMessage = `Hi <@${event.user}>, here is what I can do:

${helpText}`;

          await say({
            text: usageMessage,
            thread_ts: event.thread_ts,
          });
        } else if (command === "duplicate") {
          await handleDuplicate({
            event,
            client,
            helpRequestMessages,
            say,
          });
        } else if (command === "summarise") {
          await client.reactions.add({
            name: "eyes",
            timestamp: event.ts,
            channel: event.channel,
          });

          const messages = await extractReplies({
            client,
            messages: helpRequestMessages,
            mentionId,
            excludedCommands: ["summarise", "question"],
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
        } else if (command === "question") {
          await handleQuestion({
            event,
            client,
            helpRequestMessages,
            say,
            area,
            mentionId,
            questionText: parsedCommand.argsText,
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
