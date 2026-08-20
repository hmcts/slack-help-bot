const PRIORITY_ORDER = Object.freeze({ normal: 0, high: 1, critical: 2 });

function sanitizePriority(value) {
  return Object.hasOwn(PRIORITY_ORDER, value) ? value : "normal";
}

function sanitizePriorityAssessment(value) {
  const assessment = value && typeof value === "object" ? value : {};
  const priority = sanitizePriority(assessment.priority);
  const confidence = ["low", "medium", "high"].includes(assessment.confidence)
    ? assessment.confidence
    : "low";
  const reasons = Array.isArray(assessment.reasons)
    ? assessment.reasons
        .filter((reason) => typeof reason === "string" && reason.trim())
        .map((reason) => reason.trim().slice(0, 160))
        .slice(0, 3)
    : [];

  // Require a concrete reason before allowing an automatic escalation.
  if (priority !== "normal" && reasons.length === 0) {
    return { priority: "normal", confidence: "low", reasons: [] };
  }

  return { priority, confidence, reasons };
}

function isPriorityIncrease(currentPriority, suggestedPriority) {
  return (
    PRIORITY_ORDER[sanitizePriority(suggestedPriority)] >
    PRIORITY_ORDER[sanitizePriority(currentPriority)]
  );
}

module.exports = {
  PRIORITY_ORDER,
  sanitizePriority,
  sanitizePriorityAssessment,
  isPriorityIncrease,
};
