#!/usr/bin/env node

const { SearchClient } = require("@azure/search-documents");
const { DefaultAzureCredential } = require("@azure/identity");
const config = require("config");
const { DateTime } = require("luxon");
const { getEmbedding, cosineSimilarity } = require("../ai/ai");

const credential = new DefaultAzureCredential();

const searchClient = new SearchClient(
  config.get("search.endpoint"),
  config.get("search.help_requests_index_name"),
  credential,
);

// ranks candidates by true semantic similarity instead of just recency, so
// duplicates with different wording surface even if they aren't the newest match
async function rankByEmbeddingSimilarity(query, candidates) {
  if (candidates.length === 0) {
    return [];
  }

  const queryEmbedding = await getEmbedding(query);
  const candidateEmbeddings = await Promise.all(
    candidates.map((candidate) =>
      // analysis/resolution capture the thread's troubleshooting/outcome, not just the initial report
      getEmbedding(
        [
          candidate.title,
          candidate.description,
          candidate.analysis,
          candidate.resolution,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    ),
  );

  return candidates
    .map((candidate, index) => ({
      candidate,
      similarity: cosineSimilarity(queryEmbedding, candidateEmbeddings[index]),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map(({ candidate }) => candidate);
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

  const searchResults = await searchClient.search(query, {
    queryType: "semantic",
    filter: `created_at ge ${somewhatRecentResultsOnly} and ${areaQuery(area)}`,
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
  return rankByEmbeddingSimilarity(query, resultsWithHighScore);
}

module.exports.searchHelpRequests = searchHelpRequests;
