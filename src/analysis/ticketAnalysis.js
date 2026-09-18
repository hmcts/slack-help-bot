const {
  RESOLUTION_CATEGORIES,
  KNOWN_SUBCATEGORIES,
  normalizeCategory,
  normalizeSubCategory,
} = require("./resolutionTaxonomy");

const { TAXONOMY_RULES } = require("./resolutionTaxonomy");

function normalizeAnalysisClassification(analysis = {}) {
  const recommendedCategory = normalizeCategory(analysis.recommendedCategory);
  const hasKnownCategory = Boolean(recommendedCategory);
  const safeCategory = recommendedCategory || "Other";
  const recommendedSubCategory = normalizeSubCategory(
    safeCategory,
    analysis.recommendedSubCategory,
    hasKnownCategory ? "Other" : "Insufficient Evidence",
  );

  const nullableFields = [
    "evidenceLimitation",
    "taxonomyGap",
    "proposedCategory",
    "proposedSubCategory",
    "proposalReason",
  ];
  const normalizedNulls = Object.fromEntries(
    nullableFields
      .filter((field) =>
        ["null", "none", "n/a"].includes(
          String(analysis[field] ?? "")
            .trim()
            .toLowerCase(),
        ),
      )
      .map((field) => [field, null]),
  );

  return {
    ...analysis,
    ...normalizedNulls,
    recommendedCategory: safeCategory,
    recommendedSubCategory,
    ...(hasKnownCategory ? {} : { confidence: "low" }),
  };
}

function validateAnalysisDate(value, label) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) {
    throw new Error(
      `Invalid ${label} "${value}"; use YYYY-MM-DD, for example 2026-07-01`,
    );
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid calendar date "${value}"`);
  }
  return date;
}

/**
 * Build an analysis period. The end date is exclusive, matching the Jira JQL
 * used by the analyser. Supply either a positive number of days or an end date.
 */
function getAnalysisPeriod({ startDate, endDate, days } = {}) {
  if (!startDate) {
    throw new Error("A start date is required (use YYYY-MM-DD)");
  }
  const fromDate = validateAnalysisDate(startDate, "start date");
  if (endDate !== undefined && days !== undefined) {
    throw new Error("Specify either end date or days, not both");
  }

  let toExclusiveDate;
  if (endDate !== undefined) {
    toExclusiveDate = validateAnalysisDate(endDate, "end date");
    if (toExclusiveDate <= fromDate) {
      throw new Error("End date must be after the start date");
    }
  } else {
    const dayCount = Number(days);
    if (!Number.isInteger(dayCount) || dayCount <= 0) {
      throw new Error("Days must be a positive whole number");
    }
    toExclusiveDate = new Date(fromDate);
    toExclusiveDate.setUTCDate(toExclusiveDate.getUTCDate() + dayCount);
  }

  return {
    from: startDate,
    toExclusive: toExclusiveDate.toISOString().slice(0, 10),
  };
}

function extractSlackPermalink(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || "");
  return text.match(
    /https:\/\/[^\s|\]]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d+/i,
  )?.[0];
}

function parseSlackPermalink(permalink) {
  const match = permalink?.match(/\/archives\/([A-Z0-9]+)\/p(\d+)/i);
  if (!match) {
    return undefined;
  }

  return {
    channel: match[1],
    ts: `${match[2].slice(0, 10)}.${match[2].slice(10)}`,
  };
}

function collectText(value, result = []) {
  if (!value) {
    return result;
  }

  if (typeof value === "string") {
    result.push(value);
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, result));
    return result;
  }

  if (typeof value === "object") {
    if (typeof value.text === "string") {
      result.push(value.text);
    } else {
      collectText(value.text, result);
    }
    ["blocks", "elements", "fields", "attachments"].forEach((key) =>
      collectText(value[key], result),
    );
  }

  return result;
}

function formatSlackThread(messages) {
  return (messages || [])
    .map((message) => {
      const text = [...new Set(collectText(message))].join("\n").trim();
      return text ? `[${message.ts || "unknown time"}] ${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function getExistingClassification(labels = []) {
  const label = labels.find((value) => value.startsWith("resolution-"));
  if (!label) {
    return null;
  }

  const category = label.slice("resolution-".length).replaceAll("-", " ");
  const historicalAliases = {
    "tooling / automation deficiency": "Platform One-Off Failure",
    "existing tooling / automation limitation": "Platform One-Off Failure",
    "platform feature missing / misaligned": "Platform Improvement",
    "platform capability gap / misalignment": "Platform Improvement",
    "incident / one off platform failure": "Platform One-Off Failure",
    "one off platform failure": "Platform One-Off Failure",
  };
  return historicalAliases[category] || category;
}

function buildIssueAnalysisPrompt(issue) {
  return `Analyse this single Platform Operations support issue using all supplied Jira and Slack evidence.

Allowed existing categories:
${RESOLUTION_CATEGORIES.map((category) => `- ${category}`).join("\n")}

Known sub-categories (you may propose reusable additions):
${JSON.stringify(KNOWN_SUBCATEGORIES, null, 2)}

Rules:
${TAXONOMY_RULES}

Return JSON only:
{
  "requestOrSymptom": "concise description",
  "rootCause": "established root cause, or Not established",
  "resolution": "what resolved or closed it, or Not clear",
  "owner": "team or service owning the underlying issue, or Unknown",
  "existingClassification": "existing category or null",
  "recommendedCategory": "exactly one allowed category selected from the strongest established administrative disposition, request type, resolution, affected capability, or root cause; use Other only when none of those establish a category",
  "recommendedSubCategory": "exactly one allowed sub-category for the selected category; use the affected capability or operation even when root cause is unknown, and use Insufficient Evidence under Other only when no category can be established",
  "confidence": "high, medium, or low",
  "evidenceStatus": "established, limited, or insufficient",
  "evidenceLimitation": "missing evidence or null",
  "taxonomyGap": "why the current taxonomy is insufficient or null",
  "proposedCategory": "new category only if essential, otherwise null",
  "proposedSubCategory": "reusable sub-category only if needed, otherwise null",
  "proposalReason": "reason supported by this issue or null"
}

Jira key: ${issue.key}
Summary: ${issue.summary || ""}
Description:
${issue.description || ""}

Labels: ${JSON.stringify(issue.labels || [])}
Status: ${issue.status || "Unknown"}
Jira resolution: ${issue.jiraResolution || "None"}
Existing resolution classification: ${issue.existingClassification || "None"}
Jira comments:
${issue.comments || "None"}

Complete linked Slack thread:
${issue.slackThread || "Unavailable"}

Evidence retrieval limitation: ${issue.retrievalLimitation || "None"}`;
}

function distributionFor(analyses) {
  const counts = {};
  for (const analysis of analyses) {
    const {
      recommendedCategory: category,
      recommendedSubCategory: subCategory,
    } = normalizeAnalysisClassification(analysis);
    counts[category] ||= { total: 0, subCategories: {} };
    counts[category].total += 1;
    counts[category].subCategories[subCategory] =
      (counts[category].subCategories[subCategory] || 0) + 1;
  }
  return counts;
}

function buildReportPrompt({ period, project, analyses }) {
  const compactAnalyses = analyses.map(({ key, ...analysis }) => ({
    key,
    ...analysis,
  }));

  return `Review the completed issue-level assessments for Jira project ${project}, covering ${period.from} to ${period.toExclusive} (exclusive).

Exact issue count: ${analyses.length}. Do not state any other total. Calculate all percentages using ${analyses.length} as the denominator.

Rules:
${TAXONOMY_RULES}

Existing categories:
${RESOLUTION_CATEGORIES.map((category) => `- ${category}`).join("\n")}

Known sub-categories:
${JSON.stringify(KNOWN_SUBCATEGORIES, null, 2)}

Recommended distribution calculated from the issue assessments:
${JSON.stringify(distributionFor(analyses), null, 2)}

Issue assessments:
${JSON.stringify(compactAnalyses)}

Produce a concise but complete Markdown report containing:
1. Executive summary, including issue count, evidence limitations, and major patterns.
2. Recommended taxonomy table with category definition, sub-categories, inclusion criteria, exclusion criteria, and supporting issue count. Every category must have useful sub-categories and an Other option where appropriate.
3. Recommended category and sub-category distribution with counts and percentages.
4. Changes to the existing taxonomy: keep, clarify, rename, merge, split, or remove.
5. Ambiguous/Other cases and missing evidence.
6. A production-ready AI classification prompt based on the evidence, returning category, subCategory, confidence, evidenceStatus, and reason as strict JSON.

Do not reproduce raw Slack messages, personal data, or secrets. Do not invent evidence. Return JSON only in this shape:
{
  "reportMarkdown": "the complete Markdown report"
}`;
}

function escapeTableCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll(/\r?\n/g, " ");
}

function buildIssueAuditTable(analyses) {
  const header =
    "| Jira key | Root cause | Existing classification | Recommended category | Recommended sub-category | Confidence | Evidence limitation |\n" +
    "| --- | --- | --- | --- | --- | --- | --- |";
  const rows = analyses.map((analysis) =>
    [
      analysis.key,
      analysis.rootCause,
      analysis.existingClassification,
      analysis.recommendedCategory,
      analysis.recommendedSubCategory,
      analysis.confidence,
      analysis.evidenceLimitation,
    ]
      .map(escapeTableCell)
      .join(" | ")
      .replace(/^/, "| ")
      .replace(/$/, " |"),
  );
  return `${header}\n${rows.join("\n")}`;
}

module.exports.RESOLUTION_CATEGORIES = RESOLUTION_CATEGORIES;
module.exports.KNOWN_SUBCATEGORIES = KNOWN_SUBCATEGORIES;
module.exports.TAXONOMY_RULES = TAXONOMY_RULES;
module.exports.getAnalysisPeriod = getAnalysisPeriod;
module.exports.extractSlackPermalink = extractSlackPermalink;
module.exports.parseSlackPermalink = parseSlackPermalink;
module.exports.formatSlackThread = formatSlackThread;
module.exports.getExistingClassification = getExistingClassification;
module.exports.buildIssueAnalysisPrompt = buildIssueAnalysisPrompt;
module.exports.buildReportPrompt = buildReportPrompt;
module.exports.distributionFor = distributionFor;
module.exports.buildIssueAuditTable = buildIssueAuditTable;
module.exports.normalizeAnalysisClassification =
  normalizeAnalysisClassification;
