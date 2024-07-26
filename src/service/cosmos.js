#!/usr/bin/env node

const { DefaultAzureCredential } = require("@azure/identity");
const config = require("config");

const fsPromises = require("fs").promises;

const { CosmosClient } = require("@azure/cosmos");

const endpoint = config.get("cosmos.endpoint");

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

function getContainer() {
  const database = client.database("help-requests");
  return database.container("help-requests");
}

async function createHelpRequestInCosmos(item) {
  const container = getContainer();

  await container.items.create(item);
}

async function updateCosmosWhenHelpRequestResolved(item) {
  const container = getContainer();

  const result = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.key = @key",
      parameters: [{ name: "@key", value: item.key }],
    })
    .fetchNext();

  if (result.resources.length === 0) {
    console.log("No help request found in Cosmos for key", item.key);
    // could also create here
    return;
  }

  const { id } = result.resources[0];

  const updateObj = [];
  if (item.status) {
    updateObj.push({
      op: "add",
      path: "/status",
      value: item.status,
    });
  }
  if (item.resolution) {
    updateObj.push({
      op: "add",
      path: "/resolution",
      value: item.resolution,
    });
  }

  if (item.resolution_type) {
    updateObj.push({
      op: "add",
      path: "/resolution_type",
      value: item.resolution_type,
    });
  }

  await container.item(id, id).patch(updateObj);
}

module.exports.load = load;
module.exports.updateCosmosWhenHelpRequestResolved =
  updateCosmosWhenHelpRequestResolved;
module.exports.createHelpRequestInCosmos = createHelpRequestInCosmos;
