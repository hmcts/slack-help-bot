#!/usr/bin/env node

const { SearchClient } = require("@azure/search-documents");
const { DefaultAzureCredential } = require("@azure/identity");
const config = require("config");

const credential = new DefaultAzureCredential();

const searchClient = new SearchClient(
  config.get("search.endpoint"),
  config.get("search.index_name"),
  credential,
);

async function searchDocuments(query) {
  const searchResults = await searchClient.search(query, {
    queryType: "semantic",
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
