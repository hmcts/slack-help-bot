const { sanitizeFollowUpQuestions } = require("./parseAiResponses");

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

  it("keeps only one question even if the model returns several", () => {
    expect(
      sanitizeFollowUpQuestions({
        questions: ["First?", "Second?"],
      }),
    ).toEqual([{ question: "First?", placeholder: "" }]);
  });

  it("returns an empty list for invalid input", () => {
    expect(sanitizeFollowUpQuestions({ questions: [null, 42] })).toStrictEqual(
      [],
    );
  });
});
