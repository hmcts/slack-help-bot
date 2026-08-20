const cajache = require("cajache");
const { searchHelpRequests } = require("../../service/searchHelpRequests");
const { searchKnowledgeStore } = require("../../service/searchKnowledgeStore");
const {
  analyticsRecommendations,
  followUpQuestions,
  assessPriority,
} = require("../../ai/ai");
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

function logDependencyFailure(dependency, error) {
  console.error(`${dependency} unavailable`, {
    statusCode: error?.statusCode || error?.status,
    code: error?.code,
    message: error?.message || "Unknown error",
  });
}

function withFallback(promise, dependency, fallback, onFailure) {
  return promise.catch((error) => {
    logDependencyFailure(dependency, error);
    onFailure();
    return fallback;
  });
}

async function handler(query, analyticsQuery, area, options = {}) {
  let dependencyFailed = false;
  const recordFailure = () => {
    dependencyFailed = true;
  };
  const relatedIssuesPromise = withFallback(
    searchHelpRequests(query, area),
    "Related-issue search",
    [],
    recordFailure,
  );

  const knowledgeStorePromise = options.skipKnowledgeStore
    ? Promise.resolve([])
    : withFallback(
        searchKnowledgeStore(query, area),
        "Knowledge-store search",
        [],
        recordFailure,
      );

  const aiRecommendationPromise = withFallback(
    analyticsRecommendations(analyticsQuery, area),
    "AI recommendations",
    {},
    recordFailure,
  );

  const followUpQuestionsPromise = withFallback(
    followUpQuestions(analyticsQuery),
    "AI follow-up questions",
    [],
    recordFailure,
  );
  const priorityAssessmentPromise = withFallback(
    assessPriority(analyticsQuery),
    "AI priority assessment",
    { priority: "normal", confidence: "low", reasons: [] },
    recordFailure,
  );

  const [
    relatedIssues,
    aiRecommendation,
    followUpQuestionsResult,
    knowledgeStoreResults,
    priorityAssessment,
  ] = await Promise.all([
    relatedIssuesPromise,
    aiRecommendationPromise,
    followUpQuestionsPromise,
    knowledgeStorePromise,
    priorityAssessmentPromise,
  ]);

  console.log(relatedIssues);

  return {
    relatedIssues,
    knowledgeStoreResults,
    aiRecommendation,
    followUpQuestions: followUpQuestionsResult,
    priorityAssessment,
    dependencyFailed,
  };
}

async function queryAi(helpRequest, area, options = {}) {
  const query = createQuery(helpRequest);
  const analyticsQuery = `${helpRequest.summary} ${helpRequest.description} ${helpRequest.analysis || ""} ${helpRequest.prBuildUrl || ""}`;
  const cacheKey = `${getCacheKey(helpRequest, area)}:${options.skipKnowledgeStore ? "skip-knowledge-store" : "with-knowledge-store"}`;

  const result = await cajache.use(
    cacheKey,
    () => handler(query, analyticsQuery, area, options),
    {
      ttl: 7200, // 2 hours
    },
  );
  if (result.dependencyFailed) {
    cajache.delete(cacheKey);
  }
  const { dependencyFailed: ignored, ...safeResult } = result;
  return safeResult;
}

function deleteCacheEntry(helpRequest, area) {
  const cacheKey = getCacheKey(helpRequest, area);

  cajache.delete(`${cacheKey}:with-knowledge-store`);
  cajache.delete(`${cacheKey}:skip-knowledge-store`);
}

module.exports.queryAi = queryAi;
module.exports.deleteCacheEntry = deleteCacheEntry;
module.exports.logDependencyFailure = logDependencyFailure;
