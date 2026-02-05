#!/usr/bin/env node

const { SearchClient } = require("@azure/search-documents");
const { DefaultAzureCredential } = require("@azure/identity");
const config = require("config");
const { DateTime } = require("luxon");

const credential = new DefaultAzureCredential();

const searchClient = new SearchClient(
  config.get("search.endpoint"),
  config.get("search.help_requests_index_name"),
  credential,
);

function optimiseResults(resultsWithHighScore) {
  if (resultsWithHighScore.length === 0) {
    return [];
  }

  // take the 3 newest results
  return resultsWithHighScore
    .sort((a, b) => {
      return (
        DateTime.fromISO(b.created_at.toISOString()) -
        DateTime.fromISO(a.created_at.toISOString())
      );
    })
    .slice(0, 3);
}

function areaQuery(area) {
  if (area === "crime") {
    return "area eq 'crime'";
  }
  // handle null areas by doing not equal rather than equal
  return "area ne 'crime'";
}

async function searchHelpRequests(query, area) {
  // don't look at ancient results, this should be tuned keeping in mind the stability of the platform and when major changes happen
  const somewhatRecentResultsOnly = DateTime.now()
    .minus({ months: 18 })
    .toISO();

  const filter = `created_at ge ${somewhatRecentResultsOnly} and ${areaQuery(area)}`;
  console.log(
    `searchHelpRequests: query="${query}", area="${area}", filter="${filter}"`,
  );

  const searchResults = await searchClient.search(query, {
    queryType: "semantic",
    filter,
    semanticSearchOptions: {
      configurationName: "help-requests",
    },
    top: 30,
  });

  const resultsWithHighScore = [];
  for await (const result of searchResults.results) {
    // https://learn.microsoft.com/en-us/azure/search/search-pagination-page-layout#order-by-the-semantic-reranker
    // drop anything below 1.7 as they generally aren't that relevant
    if (result.rerankerScore && result.rerankerScore > 1.7) {
      resultsWithHighScore.push({
        ...result.document,
        _rerankerScore: result.rerankerScore,
      });
    }
  }
  const optimized = optimiseResults(resultsWithHighScore);
  console.log(
    `searchHelpRequests: found ${resultsWithHighScore.length} high-score results, returning top ${optimized.length}`,
  );
  if (optimized.length > 0) {
    console.log(
      `Top matches: ${optimized.map((r) => `${r.key} (score: ${r._rerankerScore?.toFixed(2)})`).join(", ")}`,
    );
  }
  return optimized;
}

async function searchHelpRequestsForQuestion(query, area) {
  const somewhatRecentResultsOnly = DateTime.now()
    .minus({ months: 18 })
    .toISO();

  const filter = `created_at ge ${somewhatRecentResultsOnly} and ${areaQuery(area)}`;
  console.log(
    `searchHelpRequestsForQuestion: query="${query}", area="${area}", filter="${filter}"`,
  );

  const searchResults = await searchClient.search(query, {
    queryType: "semantic",
    filter,
    semanticSearchOptions: {
      configurationName: "help-requests",
    },
    top: 30,
  });

  const resultsWithHighScore = [];
  for await (const result of searchResults.results) {
    // For question command, use stricter threshold to reduce noise
    if (result.rerankerScore && result.rerankerScore > 2.5) {
      resultsWithHighScore.push({
        ...result.document,
        _rerankerScore: result.rerankerScore,
      });
    }
  }

  const optimized = resultsWithHighScore
    .sort((a, b) => {
      return (
        DateTime.fromISO(b.created_at.toISOString()) -
        DateTime.fromISO(a.created_at.toISOString())
      );
    })
    .slice(0, 2); // Only top 2 for question command

  console.log(
    `searchHelpRequestsForQuestion: found ${resultsWithHighScore.length} high-score results (>2.5), returning top ${optimized.length}`,
  );
  if (optimized.length > 0) {
    console.log(
      `Top matches: ${optimized.map((r) => `${r.key} (score: ${r._rerankerScore?.toFixed(2)})`).join(", ")}`,
    );
  }
  return optimized;
}

module.exports.searchHelpRequests = searchHelpRequests;
module.exports.searchHelpRequestsForQuestion = searchHelpRequestsForQuestion;
