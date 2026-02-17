function mapEnvironments(value) {
  if (value === "Preview" || value === "Dev") {
    value = "Preview / Dev";
  }
  if (value === "Perftest" || value === "Test") {
    value = "Perftest / Test";
  }
  if (value === "AAT" || value === "Staging") {
    value = "AAT / Staging";
  }

  return value;
}

function sanitizeFollowUpQuestions(payload) {
  const rawQuestions = Array.isArray(payload?.questions)
    ? payload.questions
    : [];

  return rawQuestions
    .map((item) => {
      if (typeof item === "string") {
        return {
          question: item.trim(),
          placeholder: "",
        };
      }

      if (item && typeof item.question === "string") {
        return {
          question: item.question.trim(),
          placeholder:
            typeof item.placeholder === "string" ? item.placeholder.trim() : "",
        };
      }

      return null;
    })
    .filter((item) => item && item.question.length > 0)
    .slice(0, 3);
}

module.exports.mapEnvironments = mapEnvironments;
module.exports.sanitizeFollowUpQuestions = sanitizeFollowUpQuestions;
