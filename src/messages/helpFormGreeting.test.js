const { helpFormGreetingBlocks } = require("./helpFormGreeting");

describe("helpFormGreetingBlocks", () => {
  it("routes the non-crime help prompt straight to the help form", () => {
    const blocks = helpFormGreetingBlocks({
      user: "U123",
      area: "other",
      isAdvanced: false,
    });

    const button = blocks.find((block) => block.type === "actions")
      ?.elements?.[0];

    expect(button?.action_id).toBe("start_help_form");
    expect(button?.text?.text).toBe("I Still Need Help");
  });
});
