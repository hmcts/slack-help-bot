jest.mock("cajache", () => ({ use: jest.fn((key, handler) => handler()) }));
jest.mock("../../ai/ai", () => ({ summariseReleasePages: jest.fn() }));

const cajache = require("cajache");
const { summariseReleasePages } = require("../../ai/ai");
const {
  getReleaseSummaryCacheKey,
  summariseReleasePagesCached,
} = require("./releaseSummaryCache");

describe("release summary cache", () => {
  const pages = [{ id: "1", updated: "2026-08-20", content: "fix A" }];

  test("has a stable key for the same page revision and incident", () => {
    expect(getReleaseSummaryCacheKey("26.22", pages, "payment failure")).toBe(
      getReleaseSummaryCacheKey("26.22", pages, "payment failure"),
    );
  });

  test("changes key for different incident context or page content", () => {
    const original = getReleaseSummaryCacheKey(
      "26.22",
      pages,
      "payment failure",
    );
    expect(
      getReleaseSummaryCacheKey("26.22", pages, "hearing failure"),
    ).not.toBe(original);
    expect(
      getReleaseSummaryCacheKey(
        "26.22",
        [{ ...pages[0], content: "fix B" }],
        "payment failure",
      ),
    ).not.toBe(original);
  });

  test("changes key for a different follow-up focus", () => {
    expect(
      getReleaseSummaryCacheKey("26.22", pages, "listing failure", "listing"),
    ).not.toBe(
      getReleaseSummaryCacheKey(
        "26.22",
        pages,
        "listing failure",
        "publishing",
      ),
    );
  });

  test("uses the cached operation with a seven-day TTL", async () => {
    summariseReleasePages.mockResolvedValue("summary");
    await summariseReleasePagesCached("26.22", pages, "payment failure");
    expect(cajache.use).toHaveBeenCalledWith(
      expect.stringContaining("release-summary:26.22:"),
      expect.any(Function),
      { ttl: 604800 },
    );
  });
});
