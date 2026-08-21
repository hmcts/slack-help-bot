jest.mock("./helpRequestPriority", () => ({
  getPriorityFromBlocks: jest.fn(() => "critical"),
}));
jest.mock("../service/serviceCatalogue", () => ({
  getServiceCatalogueCached: jest.fn(),
}));
jest.mock("./utils/serviceOwnershipCache", () => ({
  identifyServiceOwnershipCached: jest.fn(),
}));

const { getServiceCatalogueCached } = require("../service/serviceCatalogue");
const {
  identifyServiceOwnershipCached,
} = require("./utils/serviceOwnershipCache");
const {
  hasServiceOwnership,
  formatOwnership,
  triageCriticalOwnership,
} = require("./serviceOwnership");

describe("critical service ownership triage", () => {
  const catalogue = {
    id: "1847019495",
    updated: "2026-03-12",
    url: "https://example/catalogue",
  };
  const ownership = {
    owningTeam: "Scheduling and Listing",
    contacts: ["Example Person - TL"],
    matchedServices: ["cpp.context.listing"],
    reason: "The incident explicitly names the listing context.",
    confidence: "high",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getServiceCatalogueCached.mockResolvedValue(catalogue);
    identifyServiceOwnershipCached.mockResolvedValue(ownership);
  });

  test("recognises a completed ownership marker", () => {
    expect(hasServiceOwnership([{ block_id: "service_ownership" }])).toBe(true);
  });

  test("formats the owning team, contact, component and source", () => {
    const text = formatOwnership(ownership, catalogue);
    expect(text).toContain("Scheduling and Listing");
    expect(text).toContain("Example Person - TL");
    expect(text).toContain("cpp.context.listing");
    expect(text).toContain("Service and Component Catalogue");
  });

  test("updates Slack and adds the ownership recommendation to Jira", async () => {
    const client = {
      chat: { update: jest.fn(), postMessage: jest.fn() },
    };
    const addJiraComment = jest.fn();
    const rootMessage = {
      ts: "1",
      text: "New platform help request raised",
      blocks: [{ type: "section", text: { text: "*Listing context fails*" } }],
    };

    await triageCriticalOwnership({
      event: { channel: "C1", text: "cpp.context.listing is timing out" },
      rootMessage,
      threadMessages: [],
      client,
      jiraId: "DTSPO-1",
      slackLink: "https://slack/thread",
      addJiraComment,
    });

    expect(client.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({ block_id: "service_ownership" }),
        ]),
      }),
    );
    expect(client.chat.postMessage).toHaveBeenCalled();
    expect(addJiraComment).toHaveBeenCalledWith(
      "DTSPO-1",
      expect.objectContaining({
        message: expect.stringContaining("cpp.context.listing"),
      }),
    );
  });

  test("waits for more evidence when confidence is low", async () => {
    identifyServiceOwnershipCached.mockResolvedValueOnce({
      ...ownership,
      confidence: "low",
    });
    const client = {
      chat: { update: jest.fn(), postMessage: jest.fn() },
    };

    expect(
      await triageCriticalOwnership({
        event: { channel: "C1", text: "it is broken" },
        rootMessage: { ts: "1", blocks: [] },
        threadMessages: [],
        client,
      }),
    ).toBe(false);
    expect(client.chat.update).not.toHaveBeenCalled();
  });
});
