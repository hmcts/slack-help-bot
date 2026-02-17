const {
  mapEnvironments,
  sanitizeFollowUpQuestions,
} = require("./parseAiResponses");

describe("mapEnvironments", () => {
  it("converts duel named environment to joined one", () => {
    expect(mapEnvironments("Test")).toStrictEqual("Perftest / Test");
  });
  it("handles simple case", () => {
    expect(mapEnvironments("Production")).toStrictEqual("Production");
  });
});

describe("sanitizeFollowUpQuestions", () => {
  it("accepts string questions", () => {
    expect(
      sanitizeFollowUpQuestions({
        questions: ["What is the exact error message?"],
      }),
    ).toStrictEqual([
      { question: "What is the exact error message?", placeholder: "" },
    ]);
  });

  it("accepts objects with placeholders", () => {
    expect(
      sanitizeFollowUpQuestions({
        questions: [
          {
            question: "Which service is affected?",
            placeholder: "Service name",
          },
        ],
      }),
    ).toStrictEqual([
      {
        question: "Which service is affected?",
        placeholder: "Service name",
      },
    ]);
  });

  it("returns an empty list for invalid input", () => {
    expect(sanitizeFollowUpQuestions({ questions: [null, 42] })).toStrictEqual(
      [],
    );
  });
});
