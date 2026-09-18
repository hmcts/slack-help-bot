const { buildAnalysisWorkbook, safeCellValue } = require("./analysisWorkbook");

describe("analysis workbook", () => {
  const analyses = [
    {
      key: "DTSPO-1",
      requestOrSymptom: "Jenkins failed once",
      rootCause: "Transient Jenkins failure",
      recommendedCategory: "Platform One-Off Failure",
      recommendedSubCategory: "Jenkins",
      confidence: "high",
    },
    {
      key: "DTSPO-2",
      requestOrSymptom: "GitHub access required",
      recommendedCategory: "Platform Access",
      recommendedSubCategory: "GitHub",
      confidence: "medium",
    },
  ];

  it("creates issue and distribution worksheets", () => {
    const workbook = buildAnalysisWorkbook({
      project: "DTSPO",
      period: { from: "2026-07-01", toExclusive: "2026-07-08" },
      generatedAt: "2026-08-27T10:00:00.000Z",
      analyses,
    });

    expect(workbook.getWorksheet("Issue Analysis").rowCount).toBe(3);
    expect(workbook.getWorksheet("Issue Analysis").getCell("A2").value).toBe(
      "DTSPO-1",
    );
    expect(workbook.getWorksheet("Category Distribution").rowCount).toBe(3);
    expect(workbook.getWorksheet("Sub-category Distribution").rowCount).toBe(3);
  });

  it("prevents text from being interpreted as a spreadsheet formula", () => {
    expect(safeCellValue('=HYPERLINK("https://example.com")')).toBe(
      '\'=HYPERLINK("https://example.com")',
    );
  });

  it("serializes as an Excel workbook", async () => {
    const workbook = buildAnalysisWorkbook({
      project: "DTSPO",
      period: { from: "2026-07-01", toExclusive: "2026-07-08" },
      generatedAt: "2026-08-27T10:00:00.000Z",
      analyses,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    expect(Buffer.from(buffer).subarray(0, 2).toString()).toBe("PK");
  });
});
