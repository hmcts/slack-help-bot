#!/usr/bin/env node

const { SearchClient } = require("@azure/search-documents");

const { DefaultAzureCredential } = require("@azure/identity");

// To query and manipulate documents

const config = require("config");
const { search } = require("./persistence");

const credential = new DefaultAzureCredential();

const searchClient = new SearchClient(
  config.get("search.endpoint"),
  config.get("search.index"),
  credential,
);

async function run() {
  const result = await searchClient.search(
    "Non whitelisted pattern found in HelmRelease:",
    {
      queryType: "semantic",
      semanticSearchOptions: {
        configurationName: "help-requests",
      },
    },
  );

  console.log(result);
}

run()
  .then(() => console.log("Done"))
  .catch((err) => console.log("Error", err));
