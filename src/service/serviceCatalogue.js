const config = require("config");
const cajache = require("cajache");
const { confluenceHtmlToText } = require("./releaseNotes");

async function getServiceCatalogue() {
  if (!config.has("confluence.api_token")) {
    throw new Error("CONFLUENCE_API_TOKEN is not configured");
  }

  const baseUrl = config.get("confluence.base_url").replace(/\/$/, "");
  const pageId = config.get("confluence.service_catalogue_page_id");
  const response = await fetch(
    `${baseUrl}/rest/api/content/${pageId}?expand=body.view,version`,
    {
      headers: {
        Authorization: `Bearer ${config.get("confluence.api_token")}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Confluence service catalogue failed (${response.status})`);
  }

  const page = await response.json();
  const webUi = page._links?.webui;
  return {
    id: page.id,
    title: page.title,
    updated: page.version?.when,
    content: confluenceHtmlToText(page.body?.view?.value),
    url: webUi
      ? `${baseUrl}${webUi.startsWith("/") ? "" : "/"}${webUi}`
      : `${baseUrl}/pages/viewpage.action?pageId=${pageId}`,
  };
}

function getServiceCatalogueCached() {
  return cajache.use("confluence-service-catalogue", getServiceCatalogue, {
    ttl: 3600,
  });
}

module.exports = { getServiceCatalogue, getServiceCatalogueCached };
