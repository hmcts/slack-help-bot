#!/usr/bin/env node

const { DefaultAzureCredential } = require("@azure/identity");

const fsPromises = require("fs").promises;

const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_DB_ENDPOINT;

const credential = new DefaultAzureCredential();

const client = new CosmosClient({
  endpoint,
  aadCredentials: credential,
});

async function load() {
  const documents = JSON.parse(
    await fsPromises.readFile("documents.json", "utf-8"),
  );

  console.log("Loaded documents", documents.length);

  await run(documents);
}

async function run(documents) {
  const database = client.database("help-requests");
  const container = database.container("help-requests");

  let failedItems = 0;
  let consumedRequestUnits = 0;
  const errors = [];

  async function upsertItems(container, operations) {
    const response = await container.items.bulk(operations, {
      continueOnError: true,
    });

    response.forEach((value) => {
      consumedRequestUnits += value.requestCharge;
      if (value.statusCode !== 201) {
        failedItems += 1;
        errors.push(value);
      }
    });
  }

  function splitArrayIntoChunks(arr, len) {
    const chunks = [];
    let i = 0;
    const n = arr.length;

    while (i < n) {
      chunks.push(arr.slice(i, (i += len)));
    }

    return chunks;
  }

  const splitDocuments = splitArrayIntoChunks(
    documents.map((document) => {
      return {
        operationType: "Create",
        resourceBody: document,
      };
    }),
    100,
  );

  for (const operations of splitDocuments) {
    console.log(`Upserting ${operations.length} items`);
    await upsertItems(container, operations);
    console.log("Sleeping for 1 second");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log({
    requestUnits: consumedRequestUnits,
    failedItems: failedItems,
    errors: errors,
  });
}

load()
  .then(() => console.log("Done"))
  .catch((err) => {
    console.error(
      "Error",
      err.message,
      err.code,
      err.statusCode,
      err.diagnostics,
      err.stack,
    );
  });
