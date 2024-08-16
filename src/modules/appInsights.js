const appInsights = require("applicationinsights");
const config = require("config");

function isEnabled() {
  return config.has("app_insights.connection_string");
}

const enableAppInsights = () => {
  if (isEnabled()) {
    appInsights
      .setup(config.get("app_insights.connection_string"))
      .setAutoCollectConsole(true, true);
    appInsights.defaultClient.context.tags[
      appInsights.defaultClient.context.keys.cloudRole
    ] = config.get("app_insights.role_name");
    appInsights.start();
  } else {
    console.log("No application insights connection string defined, skipping");
  }
};

const client = () => {
  return appInsights.defaultClient;
};

const trackEvent = (eventName, properties) => {
  if (isEnabled()) {
    console.log("Tracking event", eventName);
    appInsights.defaultClient.trackEvent({
      name: eventName,
      properties: properties,
    });
  }
};

module.exports = { enableAppInsights, client, trackEvent };
