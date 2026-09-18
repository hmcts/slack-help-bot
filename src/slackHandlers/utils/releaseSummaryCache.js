const cajache = require("cajache");
const { summariseReleasePages } = require("../../ai/ai");
const { hashString } = require("./hashString");

function getReleaseSummaryCacheKey(
  releaseFamily,
  pages,
  incidentContext,
  followUpFocus = "",
) {
  const pageRevisions = pages
    .map(
      (page) =>
        `${page.id}:${page.updated || "unknown"}:${hashString(page.content || "")}`,
    )
    .sort()
    .join("|");
  return `release-summary:${releaseFamily}:${hashString(
    `${incidentContext}\n${followUpFocus}\n${pageRevisions}`,
  )}`;
}

async function summariseReleasePagesCached(
  releaseFamily,
  pages,
  incidentContext,
  followUpFocus,
) {
  const cacheKey = getReleaseSummaryCacheKey(
    releaseFamily,
    pages,
    incidentContext,
    followUpFocus,
  );
  return cajache.use(
    cacheKey,
    () =>
      summariseReleasePages(
        releaseFamily,
        pages,
        incidentContext,
        followUpFocus,
      ),
    { ttl: 604800 }, // 7 days; a page revision or changed incident context gets a new key.
  );
}

module.exports = { getReleaseSummaryCacheKey, summariseReleasePagesCached };
