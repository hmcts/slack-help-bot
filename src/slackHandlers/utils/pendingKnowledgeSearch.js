const pendingKnowledgeSearch = new Map();

function getPendingKnowledgeSearchKey(channelId, userId) {
  return `${channelId}:${userId}`;
}

function setPendingKnowledgeSearch({ channelId, userId, question }) {
  pendingKnowledgeSearch.set(getPendingKnowledgeSearchKey(channelId, userId), {
    question,
    createdAt: Date.now(),
  });
}

function getPendingKnowledgeSearch({ channelId, userId }) {
  return pendingKnowledgeSearch.get(getPendingKnowledgeSearchKey(channelId, userId));
}

function clearPendingKnowledgeSearch({ channelId, userId }) {
  pendingKnowledgeSearch.delete(getPendingKnowledgeSearchKey(channelId, userId));
}

module.exports.setPendingKnowledgeSearch = setPendingKnowledgeSearch;
module.exports.getPendingKnowledgeSearch = getPendingKnowledgeSearch;
module.exports.clearPendingKnowledgeSearch = clearPendingKnowledgeSearch;
