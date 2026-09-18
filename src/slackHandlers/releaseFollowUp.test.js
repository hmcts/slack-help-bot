jest.mock("../service/releaseNotes", () => ({ findReleaseFamily: jest.fn() }));
jest.mock("./utils/releaseSummaryCache", () => ({
  summariseReleasePagesCached: jest.fn(),
}));
jest.mock("./helpRequestPriority", () => ({
  getPriorityFromBlocks: jest.fn(() => "critical"),
}));

const { findReleaseFamily } = require("../service/releaseNotes");
const { summariseReleasePagesCached } = require("./utils/releaseSummaryCache");
const { getPriorityFromBlocks } = require("./helpRequestPriority");
const { buildIncidentContext } = require("./utils/incidentContext");
const {
  extractReleaseFamily,
  extractReleaseFollowUp,
  findRecentReleaseFamily,
  formatSources,
  formatJiraSources,
  followUpWithReleaseNotes,
} = require("./releaseFollowUp");

describe("critical release follow-up", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPriorityFromBlocks.mockReturnValue("critical");
    findReleaseFamily.mockResolvedValue([
      { title: "CPP 26.22", url: "https://example/1" },
    ]);
    summariseReleasePagesCached.mockResolvedValue("Released a useful fix [1].");
  });

  test.each([
    ["last release was 26.21", "26.21"],
    ["Last production release: CPP_26.21", "26.21"],
    ["the last release is CPP 26.21.02", "26.21"],
  ])("extracts the release family from %s", (text, expected) => {
    expect(extractReleaseFamily(text)).toBe(expected);
  });

  test("does not trigger on an unrelated version", () => {
    expect(extractReleaseFamily("This started in version 26.21")).toBeNull();
  });

  test("extracts a focused follow-up request", () => {
    expect(
      extractReleaseFollowUp(
        "Follow up: can you look at the listing change in more depth?",
      ),
    ).toBe("can you look at the listing change in more depth?");
  });

  test("finds the most recently stated release family in the thread", () => {
    expect(
      findRecentReleaseFamily([
        { text: "Last release was 26.21" },
        { text: "some investigation" },
        { text: "Last release was 26.22" },
      ]),
    ).toBe("26.22");
  });

  test("renders every matched page as a numbered source", () => {
    expect(
      formatSources([
        { title: "CPP 26.21", url: "https://example/1" },
        { title: "CPP 26.21.01", url: "https://example/2" },
      ]),
    ).toBe(
      "[1] <https://example/1|CPP 26.21>\n[2] <https://example/2|CPP 26.21.01>",
    );
  });

  test("renders Jira source links using Jira markup", () => {
    expect(
      formatJiraSources([{ title: "CPP 26.22", url: "https://example/1" }]),
    ).toBe("[1] [CPP 26.22|https://example/1]");
  });

  test("builds context from the issue title, details and human replies", () => {
    const context = buildIncidentContext(
      {
        blocks: [
          { type: "section", text: { text: "*Crown hearing failure*" } },
        ],
      },
      [
        {
          bot_id: "B1",
          blocks: [
            {
              type: "section",
              text: { text: ":spiral_note_pad: Description: CCT times out" },
            },
          ],
        },
        { user: "U1", text: "Multiple court rooms are affected" },
        { user: "U1", text: "Last release was 26.22" },
      ],
      "Last release was 26.22",
    );

    expect(context).toContain("Crown hearing failure");
    expect(context).toContain("CCT times out");
    expect(context).toContain("Multiple court rooms are affected");
    expect(context).not.toContain("Last release was 26.22");
  });

  test("adds a successful release summary to the Jira ticket", async () => {
    const client = { chat: { postMessage: jest.fn() } };
    const addJiraComment = jest.fn();

    await followUpWithReleaseNotes({
      event: { text: "Last release was 26.22", channel: "C1" },
      rootMessage: { ts: "1", blocks: [] },
      client,
      jiraId: "DTSPO-1",
      slackLink: "https://slack/thread",
      addJiraComment,
    });

    expect(addJiraComment).toHaveBeenCalledWith(
      "DTSPO-1",
      expect.objectContaining({
        slackLink: "https://slack/thread",
        message: expect.stringContaining("Released a useful fix"),
      }),
    );
  });

  test("uses the previous release family for a focused follow-up", async () => {
    const client = { chat: { postMessage: jest.fn() } };
    const threadMessages = [
      { user: "U1", text: "Last release was 26.22" },
      {
        user: "U1",
        text: "Follow up: look at the listing change in more depth",
      },
    ];

    await followUpWithReleaseNotes({
      event: {
        text: "Follow up: look at the listing change in more depth",
        channel: "C1",
      },
      rootMessage: { ts: "1", blocks: [] },
      threadMessages,
      client,
    });

    expect(findReleaseFamily).toHaveBeenCalledWith("26.22");
    expect(summariseReleasePagesCached).toHaveBeenCalledWith(
      "26.22",
      expect.any(Array),
      expect.any(String),
      "look at the listing change in more depth",
    );
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("follow-up") }),
    );
  });

  test("explains when the request is not critical", async () => {
    getPriorityFromBlocks.mockReturnValueOnce("high");
    const client = { chat: { postMessage: jest.fn() } };

    await followUpWithReleaseNotes({
      event: { text: "Last release was 26.22", channel: "C1" },
      rootMessage: { ts: "1", blocks: [] },
      client,
    });

    expect(findReleaseFamily).not.toHaveBeenCalled();
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("Critical") }),
    );
  });

  test("reports a safe Confluence lookup failure in the thread", async () => {
    findReleaseFamily.mockRejectedValueOnce(new Error("403 secret details"));
    const client = { chat: { postMessage: jest.fn() } };

    await followUpWithReleaseNotes({
      event: { text: "Last release was 26.22", channel: "C1" },
      rootMessage: { ts: "1", blocks: [] },
      client,
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("couldn't retrieve"),
      }),
    );
  });
});
