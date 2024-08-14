const cajache = require("cajache");
const { searchHelpRequests } = require("../../service/searchHelpRequests");
const { searchKnowledgeStore } = require("../../service/searchKnowledgeStore");
const { analyticsRecommendations } = require("../../ai/ai");
const { hashString } = require("./hashString");

function createQuery(helpRequest) {
  return `${helpRequest.summary} ${helpRequest.description} ${helpRequest.analysis || ""}`;
}

async function handler(query, analyticsQuery, area) {
  const relatedIssuesPromise = searchHelpRequests(query, area);

  const knowledgeStorePromise = searchKnowledgeStore(query, area);

  const aiRecommendationPromise = analyticsRecommendations(
    analyticsQuery,
    area,
  );

  const relatedIssues = await relatedIssuesPromise;
  const aiRecommendation = await aiRecommendationPromise;
  const knowledgeStoreResults = await knowledgeStorePromise;

  console.log(relatedIssues);

  return {
    relatedIssues,
    knowledgeStoreResults,
    aiRecommendation,
  };
}

async function queryAi(helpRequest, area) {
  const query = createQuery(helpRequest);
  const analyticsQuery = `${helpRequest.summary} ${helpRequest.description} ${helpRequest.analysis || ""} ${helpRequest.prBuildUrl || ""}`;
  const cacheKey = hashString(query);

  return cajache.use(cacheKey, () => handler(query, analyticsQuery, area), {
    ttl: 7200, // 2 hours
  });
}

function deleteCacheEntry(helpRequest) {
  const query = createQuery(helpRequest);
  const cacheKey = hashString(query);

  cajache.delete(cacheKey);
}

module.exports.queryAi = queryAi;
module.exports.deleteCacheEntry = deleteCacheEntry;
