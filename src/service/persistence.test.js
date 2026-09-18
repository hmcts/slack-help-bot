const mockJiraClient = {
  getCurrentUser: jest.fn(),
  searchUsers: jest.fn(),
};

jest.mock("jira-client", () => jest.fn(() => mockJiraClient));

const jira = require("./persistence");

describe("convertEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJiraClient.getCurrentUser.mockResolvedValue({
      accountId: "service-account-id",
    });
  });

  it("returns the Jira Cloud account ID for an email", async () => {
    mockJiraClient.searchUsers.mockResolvedValue([
      { accountId: "bob-account-id" },
    ]);
    await expect(jira.convertEmail("bobs.uncle@hmcts.net")).resolves.toBe(
      "bob-account-id",
    );
  });

  it("returns the service account ID if null", async () => {
    await expect(jira.convertEmail(null)).resolves.toBe("service-account-id");
  });

  it("returns the service account ID if undefined", async () => {
    await expect(jira.convertEmail(undefined)).resolves.toBe(
      "service-account-id",
    );
  });

  it("passes a username through Jira's user search", async () => {
    mockJiraClient.searchUsers.mockResolvedValue([{ accountId: "bob-id" }]);
    await expect(jira.convertEmail("bobs.uncle")).resolves.toBe("bob-id");
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
            text: "View on Jira: <https://hmcts.atlassian.net/browse/DTSPO-61|DTSPO-61>",
          },
        ],
      },
    ]);

    expect(actual).toBe("DTSPO-61");
  });
});
