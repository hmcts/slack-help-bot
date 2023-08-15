const jira = require("./persistence");
const config = require("config");

const systemUser = config.get("jira.username");

describe("convertEmail", () => {
  it("strips email", () => {
    expect(jira.convertEmail("bobs.uncle@hmcts.net")).toBe("bobs.uncle");
  });
  it("returns system email if null", () => {
    expect(jira.convertEmail(null)).toBe(systemUser);
  });
  it("returns system email if undefined", () => {
    expect(jira.convertEmail(null)).toBe(systemUser);
  });
  it("returns username if no @ sign in email", () => {
    expect(jira.convertEmail("bobs.uncle")).toBe("bobs.uncle");
  });
});

describe("extractJiraId", () => {
  it("extracts the key", () => {
    const actual = jira.extractJiraIdFromBlocks([
      {},
      {},
      {},
      {},
      {
        elements: [
          {
            text: "View on Jira: <https://tools.hmcts.net/jira/browse/SBOX-61|SBOX-61>",
          },
        ],
      },
    ]);

    expect(actual).toBe("SBOX-61");
  });
});
