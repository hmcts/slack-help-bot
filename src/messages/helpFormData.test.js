const { lookupEnvironment, lookupTeam, lookupArea } = require("./helpFormData");

describe("lookupEnvironment", () => {
  it("finds environment by display name", () => {
    expect(lookupEnvironment("Production", "other")).toStrictEqual({
      text: {
        type: "plain_text",
        text: "Production",
        emoji: true,
      },
      value: "production",
    });
  });

  it("finds environment where environment has a different value to display name", () => {
    expect(lookupEnvironment("AAT / Staging", "other")).toStrictEqual({
      text: {
        type: "plain_text",
        text: "AAT / Staging",
        emoji: true,
      },
      value: "staging",
    });
  });
});

describe("lookupTeam", () => {
  it("finds team by display name", () => {
    expect(lookupTeam("Adoption", "other")).toStrictEqual({
      text: {
        type: "plain_text",
        text: "Adoption",
        emoji: true,
      },
      value: "adoption",
    });
  });

  it("finds environment where environment has a different value to display name", () => {
    expect(lookupTeam("Access Management", "other")).toStrictEqual({
      text: {
        type: "plain_text",
        text: "Access Management",
        emoji: true,
      },
      value: "am",
    });
  });
});

describe("lookupArea", () => {
  it("finds area by display name", () => {
    expect(lookupArea("AKS")).toStrictEqual({
      text: {
        type: "plain_text",
        text: "AKS",
        emoji: true,
      },
      value: "aks",
    });
  });

  it("finds environment where environment has a different value to display name", () => {
    expect(lookupArea("Azure DevOps")).toStrictEqual({
      text: {
        type: "plain_text",
        text: "Azure DevOps",
        emoji: true,
      },
      value: "azure-devops",
    });
  });
});
