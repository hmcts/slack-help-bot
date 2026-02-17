const cajache = require("cajache");
const { searchHelpRequests } = require("../../service/searchHelpRequests");
const { searchKnowledgeStore } = require("../../service/searchKnowledgeStore");
const { analyticsRecommendations, followUpQuestions } = require("../../ai/ai");
const { hashString } = require("./hashString");

function createQuery(helpRequest) {
  return `${helpRequest.summary} ${helpRequest.description} ${helpRequest.analysis || ""}`;
}

function getAreaValue(area) {
  if (typeof area === "string") {
    return area;
  }

  return area?.value || "";
}

function getCacheKey(helpRequest, area) {
  const query = createQuery(helpRequest);
  const cacheInput = `${query} ${helpRequest.prBuildUrl || ""} ${getAreaValue(
    area,
  )}`;
  return hashString(cacheInput);
}

async function handler(query, analyticsQuery, area) {
  const relatedIssuesPromise = searchHelpRequests(query, area);

  const knowledgeStorePromise = searchKnowledgeStore(query, area);

  const aiRecommendationPromise = analyticsRecommendations(
    analyticsQuery,
    area,
  );

  const followUpQuestionsPromise = followUpQuestions(analyticsQuery).catch(
    (error) => {
      console.log("An error occurred when fetching follow-up questions", error);
      return [];
    },
  );

  const relatedIssues = await relatedIssuesPromise;
  const aiRecommendation = await aiRecommendationPromise;
  const followUpQuestionsResult = await followUpQuestionsPromise;
  const knowledgeStoreResults = await knowledgeStorePromise;

  console.log(relatedIssues);

  return {
    relatedIssues,
    knowledgeStoreResults,
    aiRecommendation,
    followUpQuestions: followUpQuestionsResult,
  };
}

async function queryAi(helpRequest, area) {
  const query = createQuery(helpRequest);
  const analyticsQuery = `${helpRequest.summary} ${helpRequest.description} ${helpRequest.analysis || ""} ${helpRequest.prBuildUrl || ""}`;
  const cacheKey = getCacheKey(helpRequest, area);

  return cajache.use(cacheKey, () => handler(query, analyticsQuery, area), {
    ttl: 7200, // 2 hours
  });
}

function deleteCacheEntry(helpRequest, area) {
  const cacheKey = getCacheKey(helpRequest, area);

  cajache.delete(cacheKey);
}

module.exports.queryAi = queryAi;
module.exports.deleteCacheEntry = deleteCacheEntry;
