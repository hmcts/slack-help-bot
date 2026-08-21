const config = require("config");

const RELEASE_TITLE_PATTERN = /\bCPP\s+(\d{2}\.\d{1,2}(?:\.\d{1,2})?)\b/i;

function parseReleaseVersion(title) {
  return title?.match(RELEASE_TITLE_PATTERN)?.[1] || null;
}

function belongsToReleaseFamily(pageVersion, requestedVersion) {
  return (
    pageVersion === requestedVersion ||
    pageVersion?.startsWith(`${requestedVersion}.`)
  );
}

function compareReleaseVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function confluenceHtmlToText(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinkedReleasePageIds(html = "", requestedVersion) {
  const pageIds = new Set();
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1].replaceAll("&amp;", "&");
    const label = confluenceHtmlToText(match[2]);
    const searchableText = `${label} ${href}`.replaceAll("+", " ");
    if (
      !searchableText.includes(requestedVersion) ||
      !/(?:\bCCT\b|tech(?:nical)?\s+focused|release)/i.test(searchableText)
    ) {
      continue;
    }

    const pageId =
      href.match(/\/pages\/(\d+)(?:\/|$)/)?.[1] ||
      href.match(/[?&]pageId=(\d+)(?:&|$)/)?.[1];
    if (pageId) pageIds.add(pageId);
  }

  return [...pageIds];
}

function releasePageUrl(page) {
  const baseUrl = config.get("confluence.base_url").replace(/\/$/, "");
  return `${baseUrl}/pages/viewpage.action?pageId=${page.id}`;
}

function confluenceWebUrl(baseUrl, details, pageId) {
  const webUi = details._links?.webui;
  if (!webUi) return releasePageUrl({ id: pageId });
  return `${baseUrl}${webUi.startsWith("/") ? "" : "/"}${webUi}`;
}

async function fetchConfluencePage(baseUrl, pageId) {
  const response = await fetch(
    `${baseUrl}/rest/api/content/${pageId}?expand=body.view,version`,
    {
      headers: {
        Authorization: `Bearer ${config.get("confluence.api_token")}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Confluence page ${pageId} failed (${response.status})`);
  }
  return response.json();
}

async function findReleaseFamily(requestedVersion) {
  if (!/^\d{2}\.\d{1,2}$/.test(requestedVersion)) {
    throw new Error(`Invalid release family: ${requestedVersion}`);
  }
  if (!config.has("confluence.api_token")) {
    throw new Error("CONFLUENCE_API_TOKEN is not configured");
  }

  const baseUrl = config.get("confluence.base_url").replace(/\/$/, "");
  const parentId = config.get("confluence.functional_releases_parent_id");
  const results = [];
  let start = 0;

  do {
    const query = new URLSearchParams({
      expand: "version",
      limit: "100",
      start: String(start),
    });
    const response = await fetch(
      `${baseUrl}/rest/api/content/${parentId}/child/page?${query}`,
      {
        headers: {
          Authorization: `Bearer ${config.get("confluence.api_token")}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Confluence release search failed (${response.status})`);
    }

    const resultPage = await response.json();
    results.push(...(resultPage.results || []));
    start += resultPage.size || 0;
    if (!resultPage.size || resultPage.size < 100) break;
  } while (true);

  const matchingPages = results
    .map((page) => ({
      id: page.id,
      title: page.title,
      version: parseReleaseVersion(page.title),
      updated: page.version?.when,
      url: releasePageUrl(page),
    }))
    .filter((page) => belongsToReleaseFamily(page.version, requestedVersion))
    .sort((left, right) => compareReleaseVersions(left.version, right.version));

  const releasePages = await Promise.all(
    matchingPages.map(async (page) => {
      const details = await fetchConfluencePage(baseUrl, page.id);
      return {
        ...page,
        updated: details.version?.when || page.updated,
        url: confluenceWebUrl(baseUrl, details, page.id),
        content: confluenceHtmlToText(details.body?.view?.value),
        linkedPageIds: extractLinkedReleasePageIds(
          details.body?.view?.value,
          requestedVersion,
        ),
      };
    }),
  );

  const releasePageIds = new Set(releasePages.map((page) => page.id));
  const linkedPageIds = [
    ...new Set(releasePages.flatMap((page) => page.linkedPageIds)),
  ].filter((pageId) => !releasePageIds.has(pageId));
  const linkedPages = await Promise.all(
    linkedPageIds.map(async (pageId) => {
      const details = await fetchConfluencePage(baseUrl, pageId);
      return {
        id: pageId,
        title: details.title,
        version: requestedVersion,
        updated: details.version?.when,
        content: confluenceHtmlToText(details.body?.view?.value),
        url: confluenceWebUrl(baseUrl, details, pageId),
        linkedTechnicalRelease: true,
      };
    }),
  );

  return [
    ...releasePages.map(({ linkedPageIds: ignored, ...page }) => page),
    ...linkedPages,
  ];
}

module.exports = {
  parseReleaseVersion,
  belongsToReleaseFamily,
  compareReleaseVersions,
  confluenceHtmlToText,
  extractLinkedReleasePageIds,
  findReleaseFamily,
};
