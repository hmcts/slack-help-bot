#!/usr/bin/env node

const { SearchClient } = require("@azure/search-documents");
const { DefaultAzureCredential } = require("@azure/identity");
const config = require("config");
const { extractKnowledgeStoreHighlight } = require("../messages/util");

const credential = new DefaultAzureCredential();

const searchClient = new SearchClient(
  config.get("search.endpoint"),
  config.get("search.ops_runbook_index_name"),
  credential,
);

async function searchOpsRunbook(query) {
  const searchResults = await searchClient.search(query, {
    queryType: "semantic",
    semanticSearchOptions: {
      captions: {
        captionType: "extractive",
      },
      answers: {
        answerType: "extractive",
      },
      configurationName: "ops-runbook",
    },
  });

  const filteredResults = [];
  const highlights = new Set();
  for await (const result of searchResults.results) {
    if (result.rerankerScore && result.rerankerScore > 2) {
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

module.exports.searchOpsRunbook = searchOpsRunbook;
