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

  console.log("Pending knowledge search stored", {
    key,
    channelId,
    userId,
    questionLength: question?.length ?? 0,
    pendingCount: pendingKnowledgeSearch.size,
  });
}

function getPendingKnowledgeSearch({ channelId, userId }) {
  const key = getPendingKnowledgeSearchKey(channelId, userId);
  const pending = pendingKnowledgeSearch.get(key);

  console.log("Pending knowledge search lookup", {
    key,
    channelId,
    userId,
    found: pending !== undefined,
    ageMs: pending ? Date.now() - pending.createdAt : undefined,
    pendingCount: pendingKnowledgeSearch.size,
    keys: Array.from(pendingKnowledgeSearch.keys()),
  });

  return pending;
}

function getPendingKnowledgeSearchForChannel({ channelId }) {
  const matches = Array.from(pendingKnowledgeSearch.values()).filter(
    (pending) => pending.channelId === channelId,
  );

  return matches.sort((a, b) => b.createdAt - a.createdAt)[0];
}

function clearPendingKnowledgeSearch({ channelId, userId }) {
  const key = getPendingKnowledgeSearchKey(channelId, userId);
  const deleted = pendingKnowledgeSearch.delete(key);

  console.log("Pending knowledge search cleared", {
    key,
    channelId,
    userId,
    deleted,
    pendingCount: pendingKnowledgeSearch.size,
  });
}

module.exports.setPendingKnowledgeSearch = setPendingKnowledgeSearch;
module.exports.getPendingKnowledgeSearch = getPendingKnowledgeSearch;
module.exports.getPendingKnowledgeSearchForChannel =
  getPendingKnowledgeSearchForChannel;
module.exports.clearPendingKnowledgeSearch = clearPendingKnowledgeSearch;
