#!/usr/bin/env node

const { search } = require("./service/persistence");
const fs = require("fs");
const { uuidv7 } = require("uuidv7");

const searchQuery = `project = DTSPO AND type = "BAU Task" AND labels IN ("created-from-slack") ORDER BY created ASC `;

async function findIssues(results, startAt) {
  const result = await search(searchQuery, startAt, [
    "summary",
    "description",
    "comment",
    "created",
    "status",
  ]);

  results.push(...result.issues);

  if (result.issues.length !== 0) {
    await findIssues(results, result.startAt + result.issues.length);
  }
  return results;
}

async function extractInfo(results) {
  return results.map((result) => {
    const url = extractSection({
      beginning: "[view in Slack|",
      end: "]_",
      content: result.fields.description,
    });

    const description = extractSection({
      beginning: "*Issue description*",
      end: "*Analysis done so far*",
      content: result.fields.description,
    });

    const analysis = extractSection({
      beginning: "*Analysis done so far*: ",
      end: "*Have you checked with your team?*",
      content: result.fields.description,
    });

    const resolution = result.fields.comment.comments
      .filter((comment) =>
        comment.body.includes("Ticket resolved - see documented resolution:"),
      )
      .map((comment) => {
        return {
          resolution_type: extractSection({
            beginning: "h6. Issue type:",
            end: "h6. How it was resolved",
            content: comment.body,
          }),
          resolution: extractSection({
            beginning: "h6. How it was resolved:",
            content: comment.body,
          }),
        };
      })
      .pop();

    return {
      id: uuidv7(),
      created_at: result.fields.created,
      key: result.key,
      status: result.fields.status.name,
      title: result.fields.summary,
      description,
      analysis,
      url,
      resolution_type: resolution?.resolution_type,
      resolution: resolution?.resolution,
    };
  });
}

function extractSection({ beginning, end, content }) {
  if (!content) {
    return undefined;
  }

  const start = content.indexOf(beginning);

  const finish = end ? content.indexOf(end) : content.length;

  if (start === -1 || finish === -1) {
    return "";
  }

  return content.substring(start + beginning.length, finish).trim();
}

findIssues([])
  .then((results) => {
    return extractInfo(results);
  })
  .then((results) => {
    console.log("Results", results.length);
    const json = JSON.stringify(results);
    fs.writeFileSync("documents.json", json, "utf8");
  })
  .then(() => console.log("Done"))
  .catch((err) => console.error(err));
