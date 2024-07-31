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

async function searchHelpRequests(query) {
  // don't look at ancient results, this should be tuned keeping in mind the stability of the platform and when major changes happen
  const somewhatRecentResultsOnly = DateTime.now()
    .minus({ months: 18 })
    .toISO();

  const searchResults = await searchClient.search(query, {
    queryType: "semantic",
    filter: `created_at ge ${somewhatRecentResultsOnly}`,
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
      resultsWithHighScore.push(result.document);
    }
  }
  return optimiseResults(resultsWithHighScore);
}

module.exports.searchHelpRequests = searchHelpRequests;
