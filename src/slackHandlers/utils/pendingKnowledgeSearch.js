const pendingKnowledgeSearch = new Map();

function getPendingKnowledgeSearchKey(channelId, userId) {
  return `${channelId}:${userId}`;
}

function setPendingKnowledgeSearch({ channelId, userId, question }) {
  const key = getPendingKnowledgeSearchKey(channelId, userId);
  pendingKnowledgeSearch.set(key, {
    key,
    channelId,
    userId,
    question,
    createdAt: Date.now(),
  });
}

function getPendingKnowledgeSearch({ channelId, userId }) {
  const key = getPendingKnowledgeSearchKey(channelId, userId);
  return pendingKnowledgeSearch.get(key);
}

function getPendingKnowledgeSearchForChannel({ channelId }) {
  const matches = Array.from(pendingKnowledgeSearch.values()).filter(
    (pending) => pending.channelId === channelId,
  );

  return matches.sort((a, b) => b.createdAt - a.createdAt)[0];
}

function clearPendingKnowledgeSearch({ channelId, userId }) {
  const key = getPendingKnowledgeSearchKey(channelId, userId);
  pendingKnowledgeSearch.delete(key);
}

module.exports.setPendingKnowledgeSearch = setPendingKnowledgeSearch;
module.exports.getPendingKnowledgeSearch = getPendingKnowledgeSearch;
module.exports.getPendingKnowledgeSearchForChannel =
  getPendingKnowledgeSearchForChannel;
module.exports.clearPendingKnowledgeSearch = clearPendingKnowledgeSearch;
