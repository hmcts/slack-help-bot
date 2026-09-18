const {
  knowledgeSearchAnswerBlocks,
} = require("./messages/knowledgeSearchAnswer");
const { helpFormMainBlocks } = require("./messages/helpFormMain");
const { helpFormGoodbyeBlocks } = require("./messages/helpFormGoodbye");

const { helpRequestMainBlocks } = require("./messages/helpRequestMain");
const { helpRequestDetailBlocks } = require("./messages/helpRequestDetails");
const {
  helpRequestDuplicateBlocks,
} = require("./messages/helpRequestDuplicate");
const { helpRequestResolveBlocks } = require("./messages/helpRequestResolve");
const {
  helpRequestDocumentationBlocks,
} = require("./messages/helpRequestDocumentation");

const { appHomeMainBlocks } = require("./messages/appHomeMain");
const { appHomeIssueBlocks } = require("./messages/appHomeIssue");

const { appHomeHeaderBlocks } = require("./messages/appHomeHeader");

module.exports.knowledgeSearchAnswerBlocks = knowledgeSearchAnswerBlocks;

module.exports.helpRequestMainBlocks = helpRequestMainBlocks;
module.exports.helpRequestDetailBlocks = helpRequestDetailBlocks;
module.exports.helpRequestDuplicateBlocks = helpRequestDuplicateBlocks;
module.exports.helpRequestResolveBlocks = helpRequestResolveBlocks;
module.exports.helpRequestDocumentationBlocks = helpRequestDocumentationBlocks;

module.exports.appHomeMainBlocks = appHomeMainBlocks;
module.exports.appHomeIssueBlocks = appHomeIssueBlocks;

module.exports.appHomeHeaderBlocks = appHomeHeaderBlocks;
