const appInsights = require("applicationinsights");
const config = require('config');

const enableAppInsights = () => {
    if (config.has('app_insights.instrumentation_key')) {
        const key = config.get('app_insights.instrumentation_key');
        // Only enable if a valid key is provided (not a placeholder)
        if (key && key !== 'your-instrumentation-key' && key.trim() !== '') {
            appInsights.setup(key)
                .setAutoCollectConsole(true, true);
            appInsights.defaultClient.context
                .tags[appInsights.defaultClient.context.keys.cloudRole] = config.get('app_insights.role_name');
            appInsights.start();
        } else {
            console.log('No valid application insights key defined, skipping')
        }
    } else {
        console.log('No application insights key defined, skipping')
    }
}

const client = () => {
    return appInsights.defaultClient;
}

module.exports = {enableAppInsights, client};
