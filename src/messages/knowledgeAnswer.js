const {
  convertJiraKeyToUrl,
  convertStoragePathToHmctsWayUrl,
  stringTrim,
} = require("./util");

function getKnowledgeStoreSource(item, index) {
  const document = item.document || {};
  const title = document.title || `Source ${index + 1}`;
  const path = document.metadata_storage_path;

  if (!path) {
    return `${index + 1}. ${title}`;
  }

  return `<${convertStoragePathToHmctsWayUrl(path)}|${index + 1}. ${title}>`;
}

function removeHelpGuidance(answer) {
  return answer
    .replace(
      /\s*if you need (further )?assistance,? you can reply with "help"\.?/gi,
      "",
    )
    .replace(
      /\s*you can reply with "help" to raise a platform operations help request\.?/gi,
      "",
    )
    .trim();
}

function convertMarkdownToSlackMrkdwn(answer) {
  return answer
    .replace(/\*\*([^*\n][^*\n]*?)\*\*/g, "*$1*")
    .replace(/__([^_\n][^_\n]*?)__/g, "*$1*");
}

function getSourceResults(knowledgeStoreResults, sourceIndexes) {
  if (!sourceIndexes) {
    return knowledgeStoreResults.map((item, index) => ({ item, index }));
  }

  return sourceIndexes
    .map((sourceIndex) => ({
      item: knowledgeStoreResults[sourceIndex - 1],
      index: sourceIndex - 1,
    }))
    .filter(({ item }) => item);
}

function relatedHelpRequestResultsText(relatedIssues) {
  if (!Array.isArray(relatedIssues) || relatedIssues.length === 0) {
    return undefined;
  }

  const items = relatedIssues
    .map((issue, index) => {
      const title = issue.title || "Untitled issue";
      const resolution = issue.resolution
        ? stringTrim(issue.resolution.trim(), 400, "...")
        : "Resolution not available.";

      return `${index + 1}. <${convertJiraKeyToUrl(issue.key)}|${issue.key}> - ${title}\n   *Resolution:* ${resolution}`;
    })
    .join("\n\n");

  return `*Related JIRA issues*\n${items}`;
}

function knowledgeAnswerText({
  answer,
  knowledgeStoreResults,
  sourceIndexes,
  relatedIssues,
}) {
  const cleanedAnswer = convertMarkdownToSlackMrkdwn(
    removeHelpGuidance(answer),
  );
  const sourceText = getSourceResults(knowledgeStoreResults, sourceIndexes)
    .map(({ item, index }) => getKnowledgeStoreSource(item, index))
    .join("\n");
  const relatedHelpRequestsText = relatedHelpRequestResultsText(relatedIssues);

  const sections = [
    cleanedAnswer,
    sourceText ? `*Sources*\n${sourceText}` : undefined,
    relatedHelpRequestsText,
  ].filter(Boolean);

  return stringTrim(
    sections.join("\n\n"),
    39000,
    "\n\n_Response truncated because it was too long for Slack._",
  );
}

module.exports.knowledgeAnswerText = knowledgeAnswerText;
module.exports.getKnowledgeStoreSource = getKnowledgeStoreSource;
module.exports.removeHelpGuidance = removeHelpGuidance;
module.exports.convertMarkdownToSlackMrkdwn = convertMarkdownToSlackMrkdwn;
module.exports.getSourceResults = getSourceResults;
module.exports.relatedHelpRequestResultsText = relatedHelpRequestResultsText;
