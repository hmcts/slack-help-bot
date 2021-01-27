const config = require('config');
const { get, set } = require('lodash');

const setSecret = (secretPath, configPath) => {
    // Only overwrite the value if the secretPath is defined
    if (config.has(secretPath)) {
        set(config, configPath, get(config, secretPath));
    }
};


const setup = () => {
    if (config.has('secrets.slack-help-bot')) {
        setSecret('secrets.slack-help-bot.jira-username', 'jira.username');
        setSecret('secrets.slack-help-bot.jira-password', 'jira.password');
        setSecret('secrets.slack-help-bot.slack-bot-token', 'slack.bot_token');
        setSecret('secrets.slack-help-bot.slack-app-token', 'slack.app_token');
    }
};

module.exports = { setup };
