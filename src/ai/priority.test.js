const {
  sanitizePriorityAssessment,
  isPriorityIncrease,
} = require("./priority");

describe("priority assessment", () => {
  it("defaults unknown model output to normal", () => {
    expect(
      sanitizePriorityAssessment({
        priority: "emergency",
        confidence: "certain",
        reasons: "production",
      }),
    ).toStrictEqual({ priority: "normal", confidence: "low", reasons: [] });
  });

  it("requires evidence for an automatic escalation", () => {
    expect(
      sanitizePriorityAssessment({
        priority: "critical",
        confidence: "high",
        reasons: [],
      }),
    ).toStrictEqual({ priority: "normal", confidence: "low", reasons: [] });
  });

  it("limits and truncates model-provided reasons", () => {
    const result = sanitizePriorityAssessment({
      priority: "high",
      confidence: "high",
      reasons: ["a".repeat(200), "second", "third", "fourth"],
    });

    expect(result.priority).toBe("high");
    expect(result.reasons).toHaveLength(3);
    expect(result.reasons[0]).toHaveLength(160);
  });

  it("only identifies upward priority transitions", () => {
    expect(isPriorityIncrease("normal", "high")).toBe(true);
    expect(isPriorityIncrease("high", "critical")).toBe(true);
    expect(isPriorityIncrease("critical", "normal")).toBe(false);
    expect(isPriorityIncrease("high", "high")).toBe(false);
  });
});
