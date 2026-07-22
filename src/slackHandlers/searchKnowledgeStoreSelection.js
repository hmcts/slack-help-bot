const { searchKnowledgeStore } = require("../service/searchKnowledgeStore");
const { answerFromKnowledgeStore } = require("../ai/ai");
const { knowledgeAnswerText } = require("../messages/knowledgeAnswer");
const {
  knowledgeSearchAnswerBlocks,
} = require("../messages/knowledgeSearchAnswer");
const {
  clearPendingKnowledgeSearch,
  getPendingKnowledgeSearch,
} = require("./utils/pendingKnowledgeSearch");

async function handleKnowledgeSearchPlatformSelection(client, body, area) {
  const pending = getPendingKnowledgeSearch({
    channelId: body.channel.id,
    userId: body.user.id,
  });

  if (!pending?.question) {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "I could not find the original question. Please send it again and choose a platform.",
      blocks: [],
    });
    return;
  }

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: "Searching documentation and generating an answer...",
    blocks: [],
  });

  try {
    const knowledgeStoreResults = await searchKnowledgeStore(
      pending.question,
      area,
    );
    const knowledgeAnswer = await answerFromKnowledgeStore(
      pending.question,
      knowledgeStoreResults,
      area,
    );
    const text = knowledgeAnswerText({
      answer: knowledgeAnswer.answer,
      knowledgeStoreResults,
      sourceIndexes: knowledgeAnswer.sourceIndexes,
    });

    await client.chat.postMessage({
      channel: body.channel.id,
      text,
      blocks: knowledgeSearchAnswerBlocks({ answer: text, area }),
    });
  } catch (error) {
    console.error("An error occurred when answering a knowledge search", error);
    await client.chat.postMessage({
      channel: body.channel.id,
      text: "Sorry, I could not search the documentation right now. Please use the help request button to continue.",
      blocks: knowledgeSearchAnswerBlocks({
        answer:
          "Sorry, I could not search the documentation right now. Please use the help request button to continue.",
        area,
      }),
    });
  } finally {
    clearPendingKnowledgeSearch({
      channelId: body.channel.id,
      userId: body.user.id,
    });
  }
}

module.exports.handleKnowledgeSearchPlatformSelection =
  handleKnowledgeSearchPlatformSelection;
