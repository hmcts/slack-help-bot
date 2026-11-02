const { answerFeePayQuestion } = require("../service/feePayKnowledge");

function textOf(message) {
  return typeof message.text === "string" ? message.text.trim() : "";
}

async function loadConversation(client, message, threadTs) {
  try {
    const messages = [];
    let cursor;
    do {
      const response = await client.conversations.replies({
        channel: message.channel,
        ts: threadTs,
        limit: 30,
        ...(cursor ? { cursor } : {}),
      });
      messages.push(...(response.messages || []));
      cursor = response.response_metadata?.next_cursor;
    } while (cursor);
    return messages
      .filter((item) => item.ts !== message.ts && textOf(item))
      .slice(-8)
      .map((item) => ({
        role: item.bot_id || item.app_id ? "assistant" : "user",
        content: textOf(item).slice(0, 1500),
      }));
  } catch (error) {
    console.warn("Could not load Agent conversation history", error.message);
    return [];
  }
}

async function handleFeePayAgentMessage({ event, client }) {
  if (
    event.channel_type !== "im" ||
    event.bot_id ||
    event.subtype ||
    !textOf(event)
  ) {
    return;
  }

  const threadTs = event.thread_ts || event.ts;
  try {
    const conversation = await loadConversation(client, event, threadTs);
    const answer = await answerFeePayQuestion({
      question: textOf(event),
      conversation,
    });
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: threadTs,
      text: answer,
      mrkdwn: true,
    });
  } catch (error) {
    console.error("FeePay Agent could not answer the message", error);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: threadTs,
      text: "I couldn't search the Fee and Payments sources just now. Please try again later or use the existing help-request workflow.",
    });
  }
}

module.exports = { handleFeePayAgentMessage };
