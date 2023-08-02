const config = require('config')

const { helpFormGreetingBlocks } = require('./messages/helpFormGreeting')
const { helpFormPlatoBlocks } = require('./messages/helpFormPlato')
const { helpFormMainBlocks } = require('./messages/helpFormMain')
const { helpFormGoodbyeBlocks } = require('./messages/helpFormGoodbye')

const { helpRequestMainBlocks } = require('./messages/helpRequestMain')
const { helpRequestDetailBlocks } = require('./messages/helpRequestDetails')
const { helpRequestDuplicateBlocks } = require('./messages/helpRequestDuplicate')
const { helpRequestResolveBlocks } = require('./messages/helpRequestResolve')
const { helpRequestDocumentationBlocks } = require('./messages/helpRequestDocumentation')

const { appHomeMainBlocks } = require('./messages/appHomeMain')
const { appHomeUnassignedOpenIssueBlocks } = require('./messages/appHomeUnassignedOpenIssue')

const { configureWorkflowStepBlocks } = require('./messages/configureWorkflowStep')

module.exports.helpFormGreetingBlocks = helpFormGreetingBlocks;
module.exports.helpFormPlatoBlocks = helpFormPlatoBlocks;
module.exports.helpFormMainBlocks = helpFormMainBlocks;
module.exports.helpFormGoodbyeBlocks = helpFormGoodbyeBlocks;

module.exports.helpRequestMainBlocks = helpRequestMainBlocks;
module.exports.helpRequestDetailBlocks = helpRequestDetailBlocks;
module.exports.helpRequestDuplicateBlocks = helpRequestDuplicateBlocks;
module.exports.helpRequestResolveBlocks = helpRequestResolveBlocks;
module.exports.helpRequestDocumentationBlocks = helpRequestDocumentationBlocks;

module.exports.appHomeUnassignedOpenIssueBlocks = appHomeUnassignedOpenIssueBlocks;
module.exports.appHomeMainBlocks = appHomeMainBlocks;

module.exports.configureWorkflowStepBlocks = configureWorkflowStepBlocks