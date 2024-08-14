#!/usr/bin/env node

const { SearchClient } = require("@azure/search-documents");
const { DefaultAzureCredential } = require("@azure/identity");
const config = require("config");
const { extractKnowledgeStoreHighlight } = require("../messages/util");

const credential = new DefaultAzureCredential();

const searchClient = new SearchClient(
  config.get("search.endpoint"),
  config.get("search.knowledge_store_index_name"),
  credential,
);

async function searchKnowledgeStore(query, area) {
  if (area === "crime") {
    // no known knowledge store for crime at this time so just skip it for now
    return [];
  }
  const searchResults = await searchClient.search(query, {
    queryType: "semantic",
    semanticSearchOptions: {
      captions: {
        captionType: "extractive",
      },
      answers: {
        answerType: "extractive",
      },
      configurationName: "the-hmcts-way",
    },
  });

  const filteredResults = [];
  const highlights = new Set();
  for await (const result of searchResults.results) {
    // https://learn.microsoft.com/en-us/azure/search/search-pagination-page-layout#order-by-the-semantic-reranker
    // drop anything below 2 as they generally aren't that relevant
    if (result.rerankerScore && result.rerankerScore > 2) {
      // duplicate results can happen in the search results, so we need to filter them out
      const highlight = extractKnowledgeStoreHighlight(result);
      if (highlights.has(highlight)) {
        continue;
      }
      highlights.add(highlight);

      filteredResults.push(result);
    }
  }

  return filteredResults.slice(0, 5);
}

module.exports.searchKnowledgeStore = searchKnowledgeStore;
