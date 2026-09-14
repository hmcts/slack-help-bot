const config = require('config');

const logTag = `[${config.get('app_insights.role_name')}]`;

const LEVELS = ['log', 'info', 'warn', 'error', 'debug', 'trace'];

function setup() {
    for (const level of LEVELS) {
        const original = console[level];
        console[level] = (...args) => original(logTag, ...args);
    }
}

module.exports.setup = setup