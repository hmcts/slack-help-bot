const { searchKnowledgeStore } = require("./searchKnowledgeStore");
const {
  answerFromKnowledgeStore,
  rewriteKnowledgeSearchQuery,
} = require("../ai/ai");
const { knowledgeAnswerText } = require("../messages/knowledgeAnswer");

async function answerConversation({ question, area, conversation = [] }) {
  let searchQuery = question;
  try {
    searchQuery = await rewriteKnowledgeSearchQuery(question, conversation);
  } catch (error) {
    console.warn(
      "Could not rewrite the contextual knowledge search query; using the latest message",
      error,
    );
  }
  const knowledgeStoreResults = await searchKnowledgeStore(searchQuery, area);
  const knowledgeAnswer = await answerFromKnowledgeStore(
    question,
    knowledgeStoreResults,
    area,
    conversation,
  );
  const text = knowledgeAnswerText({
    answer: knowledgeAnswer.answer,
    knowledgeStoreResults,
    sourceIndexes: knowledgeAnswer.sourceIndexes,
  });

  return {
    text,
    resultCount: knowledgeAnswer.sourceIndexes.length,
    requiresReadConfirmation: knowledgeAnswer.sourceIndexes.length > 0,
  };
}

module.exports.answerConversation = answerConversation;
