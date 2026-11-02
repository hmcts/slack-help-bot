#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const indexDefinition = require("../config/knowledge-index.json");
const config = require("config");
const { DefaultAzureCredential } = require("@azure/identity");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const JiraApi = require("jira-client");
const sources = require("../config/knowledge-sources.json");

const SEARCH_API_VERSION = "2024-07-01";
const SEARCH_SCOPE = "https://search.azure.com/.default";
const CHUNK_LENGTH = 3500;
const CHUNK_OVERLAP = 250;
const UPLOAD_BATCH_SIZE = 250;
const MAX_GITHUB_FILE_SIZE = 120_000;
const credential = new DefaultAzureCredential();

function requiredConfig(path) {
  if (!config.has(path) || !config.get(path)) {
    throw new Error(`Missing configuration: ${path}`);
  }
  return config.get(path);
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function plainText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(plainText).join(" ");
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (Array.isArray(value.content)) return plainText(value.content);
    return Object.values(value).map(plainText).join(" ");
  }
  return String(value);
}

function cleanHtml(value) {
  return String(value || "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoChunks(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const chunks = [];
  for (let start = 0; start < normalized.length; start += CHUNK_LENGTH - CHUNK_OVERLAP) {
    chunks.push(normalized.slice(start, start + CHUNK_LENGTH));
  }
  return chunks;
}

function toSearchDocuments({ title, url, content, sourceType, sourceName }) {
  return splitIntoChunks(content).map((chunk, index) => ({
    id: crypto.createHash("sha256").update(`${url}#${index}`).digest("hex"),
    title,
    url,
    content: chunk,
    sourceType,
    sourceName,
  }));
}

function jiraClient() {
  const baseUrl = new URL(config.get("jira.api_url"));
  const cloudId = requiredConfig("jira.cloud_id");
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/${cloudId}`;
  return new JiraApi({
    protocol: baseUrl.protocol.replace(":", ""),
    host: baseUrl.hostname,
    port: baseUrl.port,
    base: baseUrl.pathname.replace(/\/+$/, ""),
    username: requiredConfig("jira.username"),
    password: requiredConfig("jira.api_token"),
    apiVersion: "3",
    strictSSL: true,
  });
}

async function loadJiraIssues() {
  const jira = jiraClient();
  const project = sources.atlassian.jiraProjectKey;
  const label = sources.atlassian.jiraIssueLabel;
  const issues = [];
  let startAt = 0;
  let total = 0;
  do {
    const page = await jira.searchJira(
      `project = ${project} AND labels = "${label}" ORDER BY updated DESC`,
      {
        startAt,
        maxResults: 100,
        fields: ["summary", "description", "comment", "status", "issuetype", "created", "updated"],
      },
    );
    issues.push(...(page.issues || []));
    total = page.total || 0;
    startAt += (page.issues || []).length;
  } while (startAt < total && startAt > 0);

  const browseUrl = trimTrailingSlash(requiredConfig("jira.browse_url"));
  return issues.flatMap((issue) => {
    const fields = issue.fields || {};
    const comments = fields.comment?.comments || [];
    const content = [
      `Issue: ${issue.key}`,
      `Type: ${fields.issuetype?.name || ""}`,
      `Status: ${fields.status?.name || ""}`,
      `Created: ${fields.created || ""}`,
      `Updated: ${fields.updated || ""}`,
      `Description: ${plainText(fields.description)}`,
      ...comments.map((comment) => `Comment: ${plainText(comment.body)}`),
    ].join("\n");
    return toSearchDocuments({
      title: `${issue.key}: ${fields.summary || "Untitled issue"}`,
      url: `${browseUrl}/browse/${issue.key}`,
      content,
      sourceType: "jira",
      sourceName: `Jira ${project}`,
    });
  });
}

function atlassianHeaders() {
  const username = requiredConfig("jira.username");
  const token = requiredConfig("jira.api_token");
  return {
    authorization: `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`,
    accept: "application/json",
  };
}

async function getJson(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GET ${url} failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return response.json();
}

async function loadConfluencePages() {
  const base = `${trimTrailingSlash(requiredConfig("jira.browse_url"))}/wiki`;
  const spaceKey = sources.atlassian.confluenceSpaceKey;
  const label = sources.atlassian.confluencePageLabel;
  const cql = `space="${spaceKey}" AND type=page AND status=current AND label="${label}"`;
  const pages = [];
  const headers = atlassianHeaders();
  let url = `${base}/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=100&expand=body.storage,version`;

  while (true) {
    const page = await getJson(url, headers);
    pages.push(...(page.results || []));
    const next = page._links?.next;
    if (!next) break;
    url = new URL(next.startsWith("/rest/") ? `/wiki${next}` : next, url).href;
  }

  return pages.flatMap((page) => {
    const content = cleanHtml(page.body?.storage?.value);
    return toSearchDocuments({
      title: page.title || "Untitled Confluence page",
      url: page._links?.webui ? `${base}${page._links.webui}` : `${base}/spaces/${spaceKey}`,
      content,
      sourceType: "confluence",
      sourceName: `Confluence ${spaceKey}`,
    });
  });
}

function isRelevantGithubPath(path) {
  const normalized = path.toLowerCase();
  if (
    /(^|\/)(node_modules|target|build|dist|coverage|\.git|vendor|\.terraform)(\/|$)/.test(normalized) ||
    /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(js|css))$/.test(normalized)
  ) {
    return false;
  }
  return /\.(md|mdx|java|js|jsx|ts|tsx|py|tf|yml|yaml|json|xml|sql|properties|sh|gradle|groovy|kt)$/.test(normalized);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await mapper(items[index], index);
      }
    }),
  );
  return results;
}

async function loadGithubRepository(repository) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "feepay-source-"));
  const repositoryDirectory = path.join(temporaryDirectory, "repository");
  try {
    // Public repositories can be cloned anonymously. When supplied, GITHUB_TOKEN
    // is passed through Git's environment configuration so it is not included in
    // the clone URL or command-line arguments.
    const cloneEnvironment = { ...process.env };
    if (process.env.GITHUB_TOKEN) {
      cloneEnvironment.GIT_CONFIG_COUNT = "1";
      cloneEnvironment.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
      cloneEnvironment.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(
        `x-access-token:${process.env.GITHUB_TOKEN}`,
      ).toString("base64")}`;
    }
    execFileSync(
      "git",
      ["clone", "--depth", "1", `https://github.com/${repository}.git`, repositoryDirectory],
      { stdio: "ignore", env: cloneEnvironment },
    );
    const branch = execFileSync(
      "git",
      ["-C", repositoryDirectory, "rev-parse", "--abbrev-ref", "HEAD"],
      { encoding: "utf8" },
    ).trim();
    const files = [];
    function walk(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!/(^|\/)(node_modules|target|build|dist|coverage|\.git|vendor|\.terraform)$/i.test(entry.name)) {
            walk(path.join(directory, entry.name));
          }
          continue;
        }
        if (!entry.isFile()) continue;
        const absolutePath = path.join(directory, entry.name);
        const relativePath = path.relative(repositoryDirectory, absolutePath).split(path.sep).join("/");
        if (
          fs.statSync(absolutePath).size <= MAX_GITHUB_FILE_SIZE &&
          isRelevantGithubPath(relativePath)
        ) {
          files.push({ absolutePath, relativePath });
        }
      }
    }
    walk(repositoryDirectory);

    return files.flatMap(({ absolutePath, relativePath }) => {
      const content = fs.readFileSync(absolutePath, "utf8");
      if (content.includes("\u0000")) return [];
      const encodedBranch = branch.split("/").map(encodeURIComponent).join("/");
      const url = `https://github.com/${repository}/blob/${encodedBranch}/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
      return toSearchDocuments({
        title: `${repository}: ${relativePath}`,
        url,
        content,
        sourceType: "github",
        sourceName: repository,
      });
    });
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

async function searchToken() {
  const token = await credential.getToken(SEARCH_SCOPE);
  if (!token?.token) throw new Error("Could not obtain Azure AI Search access token");
  return token.token;
}

async function searchRequest(url, token, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Azure AI Search request failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return response.json();
}

async function ensureSearchIndex(endpoint, indexName, token) {
  const url = `${endpoint}/indexes/${encodeURIComponent(indexName)}?api-version=${SEARCH_API_VERSION}`;
  const semanticConfiguration = requiredConfig("search.semantic_configuration");
  const existing = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (existing.ok) {
    const existingDefinition = await existing.json();
    const existingFields = new Set((existingDefinition.fields || []).map((field) => field.name));
    const missingFields = indexDefinition.fields
      .map((field) => field.name)
      .filter((fieldName) => !existingFields.has(fieldName));
    const hasSemanticConfiguration = existingDefinition.semantic?.configurations?.some(
      (configuration) => configuration.name === semanticConfiguration,
    );
    if (missingFields.length > 0 || !hasSemanticConfiguration) {
      throw new Error(
        `Existing index ${indexName} is missing required fields/configuration. ` +
        `Missing fields: ${missingFields.join(", ") || "none"}; semantic configuration present: ${hasSemanticConfiguration}`,
      );
    }
    return;
  }
  if (existing.status !== 404) {
    const detail = await existing.text();
    throw new Error(`Could not inspect Azure AI Search index (${existing.status}): ${detail.slice(0, 500)}`);
  }

  const created = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...indexDefinition,
      name: indexName,
      semantic: {
        ...indexDefinition.semantic,
        configurations: indexDefinition.semantic.configurations.map((configuration) => ({
          ...configuration,
          name: semanticConfiguration,
        })),
      },
    }),
  });
  if (!created.ok) {
    const detail = await created.text();
    throw new Error(`Could not create Azure AI Search index (${created.status}): ${detail.slice(0, 500)}`);
  }
  console.log(`Created Azure AI Search index ${indexName}`);
}

async function loadExistingDocumentIds(endpoint, indexName, token) {
  const url = `${endpoint}/indexes/${encodeURIComponent(indexName)}/docs/search?api-version=${SEARCH_API_VERSION}`;
  const ids = [];
  for (let skip = 0; ; skip += 1000) {
    if (skip > 100_000) {
      throw new Error("Index exceeds the supported stale-document cleanup range");
    }
    const result = await searchRequest(url, token, {
      search: "*",
      select: "id",
      top: 1000,
      skip,
    });
    const page = result.value || [];
    ids.push(...page.map((document) => document.id).filter(Boolean));
    if (page.length < 1000) return ids;
  }
}

async function uploadDocuments(documents) {
  const endpoint = trimTrailingSlash(requiredConfig("search.endpoint"));
  const indexName = requiredConfig("search.knowledge_store_index_name");
  const token = await searchToken();
  const url = `${endpoint}/indexes/${encodeURIComponent(indexName)}/docs/index?api-version=${SEARCH_API_VERSION}`;
  await ensureSearchIndex(endpoint, indexName, token);
  const existingIds = await loadExistingDocumentIds(endpoint, indexName, token);
  const desiredIds = new Set(documents.map((document) => document.id));

  for (let start = 0; start < documents.length; start += UPLOAD_BATCH_SIZE) {
    const batch = documents.slice(start, start + UPLOAD_BATCH_SIZE).map((document) => ({
      "@search.action": "upload",
      ...document,
    }));
    const result = await searchRequest(url, token, { value: batch });
    const failed = (result.value || []).filter((item) => !item.status);
    if (failed.length > 0) {
      throw new Error(`Azure AI Search failed to index ${failed.length} documents`);
    }
    console.log(`Indexed ${Math.min(start + batch.length, documents.length)} / ${documents.length} chunks`);
  }

  const staleIds = existingIds.filter((id) => !desiredIds.has(id));
  for (let start = 0; start < staleIds.length; start += UPLOAD_BATCH_SIZE) {
    const batch = staleIds.slice(start, start + UPLOAD_BATCH_SIZE).map((id) => ({
      "@search.action": "delete",
      id,
    }));
    const result = await searchRequest(url, token, { value: batch });
    const failed = (result.value || []).filter((item) => !item.status);
    if (failed.length > 0) {
      throw new Error(`Azure AI Search failed to remove ${failed.length} stale documents`);
    }
  }
  if (staleIds.length > 0) {
    console.log(`Removed ${staleIds.length} stale chunks`);
  }
}

async function main() {
  const feePayRepos = sources.github.feeAndPaymentsRepositories;
  const reformRepos = sources.github.hmctsReformRepositories;
  const repositories = [...new Set([...feePayRepos, ...reformRepos])];

  console.log(`Reading Jira project ${sources.atlassian.jiraProjectKey}`);
  const jiraDocuments = await loadJiraIssues();
  console.log(`Prepared ${jiraDocuments.length} Jira chunks`);

  console.log(`Reading Confluence space ${sources.atlassian.confluenceSpaceKey}`);
  const confluenceDocuments = await loadConfluencePages();
  console.log(`Prepared ${confluenceDocuments.length} Confluence chunks`);

  const githubByRepository = await mapWithConcurrency(repositories, 3, async (repository) => {
    console.log(`Reading GitHub repository ${repository}`);
    return loadGithubRepository(repository);
  });
  const githubDocuments = githubByRepository.flat();
  console.log(`Prepared ${githubDocuments.length} GitHub chunks`);

  const documents = [...jiraDocuments, ...confluenceDocuments, ...githubDocuments];
  if (documents.length === 0) throw new Error("No source documents were found; index upload cancelled");
  await uploadDocuments(documents);
  console.log(`Source sync complete: ${documents.length} chunks uploaded to ${config.get("search.knowledge_store_index_name")}`);
}

main().catch((error) => {
  console.error("FeePay knowledge source sync failed", error);
  process.exitCode = 1;
});
