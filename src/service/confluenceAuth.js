const config = require("config");

function confluenceAuthorization(
  tokenPath = "confluence.api_token",
  useBasicAuthentication = true,
) {
  if (!config.has(tokenPath)) {
    throw new Error(`${tokenPath} is not configured`);
  }
  const token = config.get(tokenPath);
  if (useBasicAuthentication && config.has("confluence.username")) {
    const credentials = Buffer.from(
      `${config.get("confluence.username")}:${token}`,
    ).toString("base64");
    return `Basic ${credentials}`;
  }
  return `Bearer ${token}`;
}

function confluenceHeaders(tokenPath, useBasicAuthentication) {
  return {
    Authorization: confluenceAuthorization(tokenPath, useBasicAuthentication),
    Accept: "application/json",
  };
}

module.exports = { confluenceAuthorization, confluenceHeaders };
