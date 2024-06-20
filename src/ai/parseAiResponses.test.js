const { mapEnvironments } = require("./parseAiResponses");

describe("mapEnvironments", () => {
  it("converts duel named environment to joined one", () => {
    expect(mapEnvironments("Test")).toStrictEqual("Perftest / Test");
  });
  it("handles simple case", () => {
    expect(mapEnvironments("Production")).toStrictEqual("Production");
  });
});
