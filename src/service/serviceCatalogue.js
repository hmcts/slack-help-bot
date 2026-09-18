const config = require("config");
const cajache = require("cajache");
const { confluenceHtmlToText } = require("./releaseNotes");
const { confluenceHeaders } = require("./confluenceAuth");

async function getServiceCatalogue() {
  const baseUrl = config
    .get("confluence.service_catalogue_base_url")
    .replace(/\/$/, "");
  const pageId = config.get("confluence.service_catalogue_page_id");
  const response = await fetch(
    `${baseUrl}/rest/api/content/${pageId}?expand=body.view,version`,
    {
      headers: confluenceHeaders(),
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
