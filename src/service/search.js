#!/usr/bin/env node

const { SearchClient } = require("@azure/search-documents");
const { DefaultAzureCredential } = require("@azure/identity");
const config = require("config");
const {DateTime} = require("luxon");

const credential = new DefaultAzureCredential();

const searchClient = new SearchClient(
  config.get("search.endpoint"),
  config.get("search.index_name"),
  credential,
);

async function searchDocuments(query) {
  // don't look at ancient results, this should be tuned keeping in mind the stability of the platform and when major changes happen
  const somewhatRecentResultsOnly = DateTime.now().minus({ months: 18 }).toISO()

  const searchResults = await searchClient.search(query, {
    queryType: "semantic",
    filter: `created_at ge ${somewhatRecentResultsOnly}`,
    semanticSearchOptions: {
      configurationName: "help-requests",
    },
    top: 3,
  });

  const filteredResults = [];
  for await (const result of searchResults.results) {
    // https://learn.microsoft.com/en-us/azure/search/search-pagination-page-layout#order-by-the-semantic-reranker
    // drop anything below 2 as they generally aren't that relevant
    if (result.rerankerScore && result.rerankerScore > 2) {
      filteredResults.push(result);
    }
  }

  return filteredResults.map((result) => result.document);
}

module.exports.searchDocuments = searchDocuments;
