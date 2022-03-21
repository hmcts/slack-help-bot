const appInsights = require("applicationinsights");
const config = require('config');

const enableAppInsights = () => {
    if (config.has('app_insights.instrumentation_key')) {
        appInsights.setup(config.get('app_insights.instrumentation_key'))
            .setAutoCollectConsole(true, true);
        appInsights.defaultClient.context
            .tags[appInsights.defaultClient.context.keys.cloudRole] = config.get('app_insights.role_name');
        appInsights.start();
    } else {
        console.log('No application insights key defined, skipping')
    }
}

const client = () => {
    return appInsights.defaultClient;
}

module.exports = {enableAppInsights, client};
