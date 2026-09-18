const values = {
  "confluence.username": "engineer@example.com",
  "confluence.api_token": "cloud-token",
};

jest.mock("config", () => ({
  has: jest.fn((key) => Object.hasOwn(values, key)),
  get: jest.fn((key) => values[key]),
}));

const { confluenceAuthorization } = require("./confluenceAuth");

describe("Confluence authentication", () => {
  test("uses Basic authentication for Atlassian Cloud", () => {
    expect(confluenceAuthorization()).toBe(
      `Basic ${Buffer.from("engineer@example.com:cloud-token").toString(
        "base64",
      )}`,
    );
  });

  test("supports explicit Bearer authentication", () => {
    expect(confluenceAuthorization("confluence.api_token", false)).toBe(
      "Bearer cloud-token",
    );
  });
});
