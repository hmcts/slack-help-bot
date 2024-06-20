const { parseResponseToRecommendation } = require("./parseAiResponses");

describe("parseResponseToRecommendation", () => {
  it("parses known response to expected format", () => {
    expect(
      parseResponseToRecommendation(
        "environment=Production, team=No fault divorce, area=GitHub,",
      ),
    ).toStrictEqual({
      environment: "Production",
      team: "No fault divorce",
      area: "GitHub",
    });
  });
});
