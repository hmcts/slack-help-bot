const ExcelJS = require("exceljs");
const { distributionFor } = require("./ticketAnalysis");

const ISSUE_COLUMNS = [
  ["Jira Key", "key"],
  ["Request / Symptom", "requestOrSymptom"],
  ["Root Cause", "rootCause"],
  ["Resolution", "resolution"],
  ["Owner", "owner"],
  ["Existing Classification", "existingClassification"],
  ["Recommended Category", "recommendedCategory"],
  ["Recommended Sub-category", "recommendedSubCategory"],
  ["Confidence", "confidence"],
  ["Evidence Limitation", "evidenceLimitation"],
  ["Taxonomy Gap", "taxonomyGap"],
  ["Proposed Category", "proposedCategory"],
  ["Proposed Sub-category", "proposedSubCategory"],
  ["Proposal Reason", "proposalReason"],
  ["Analysis Error", "analysisError"],
];

function safeCellValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function styleTableWorksheet(worksheet, widths) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: worksheet.rowCount, column: worksheet.columnCount },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" },
  };
  worksheet.columns.forEach((column, index) => {
    column.width = widths[index] || 22;
    column.alignment = { vertical: "top", wrapText: true };
  });
}

function buildAnalysisWorkbook({ project, period, generatedAt, analyses }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "slack-help-bot";
  workbook.created = new Date(generatedAt);

  const metadata = workbook.addWorksheet("Metadata");
  metadata.addRows([
    ["Field", "Value"],
    ["Project", safeCellValue(project)],
    ["Period start", period.from],
    ["Period end (exclusive)", period.toExclusive],
    ["Generated at", generatedAt],
    ["Issues analysed", analyses.length],
  ]);
  styleTableWorksheet(metadata, [24, 40]);

  const issues = workbook.addWorksheet("Issue Analysis");
  issues.addRow(ISSUE_COLUMNS.map(([heading]) => heading));
  for (const analysis of analyses) {
    issues.addRow(ISSUE_COLUMNS.map(([, key]) => safeCellValue(analysis[key])));
  }
  styleTableWorksheet(
    issues,
    ISSUE_COLUMNS.map(([, key]) =>
      ["key", "confidence", "analysisError"].includes(key) ? 18 : 34,
    ),
  );

  const distribution = distributionFor(analyses);
  const total = analyses.length;
  const categorySheet = workbook.addWorksheet("Category Distribution");
  categorySheet.addRow(["Category", "Count", "Percentage"]);
  for (const [category, values] of Object.entries(distribution).sort()) {
    categorySheet.addRow([
      safeCellValue(category),
      values.total,
      total === 0 ? 0 : values.total / total,
    ]);
  }
  categorySheet.getColumn(3).numFmt = "0.0%";
  styleTableWorksheet(categorySheet, [42, 12, 14]);

  const subCategorySheet = workbook.addWorksheet("Sub-category Distribution");
  subCategorySheet.addRow([
    "Category",
    "Sub-category",
    "Count",
    "Percentage of all issues",
  ]);
  for (const [category, values] of Object.entries(distribution).sort()) {
    for (const [subCategory, count] of Object.entries(
      values.subCategories,
    ).sort()) {
      subCategorySheet.addRow([
        safeCellValue(category),
        safeCellValue(subCategory),
        count,
        total === 0 ? 0 : count / total,
      ]);
    }
  }
  subCategorySheet.getColumn(4).numFmt = "0.0%";
  styleTableWorksheet(subCategorySheet, [42, 36, 12, 24]);

  return workbook;
}

async function writeAnalysisWorkbook(filePath, data) {
  const workbook = buildAnalysisWorkbook(data);
  await workbook.xlsx.writeFile(filePath);
}

module.exports.ISSUE_COLUMNS = ISSUE_COLUMNS;
module.exports.safeCellValue = safeCellValue;
module.exports.buildAnalysisWorkbook = buildAnalysisWorkbook;
module.exports.writeAnalysisWorkbook = writeAnalysisWorkbook;
