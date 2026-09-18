jest.mock("config", () => ({
  get: jest.fn((key) => {
    if (key === "confluence.base_url") return "https://example/confluence";
    if (key === "confluence.functional_releases_parent_id") return "123";
    return "token";
  }),
  has: jest.fn(() => true),
}));

const {
  parseReleaseVersion,
  belongsToReleaseFamily,
  compareReleaseVersions,
  confluenceHtmlToText,
  extractLinkedReleasePageIds,
} = require("./releaseNotes");

describe("release note matching", () => {
  test.each([
    ["CPP 26.21 Release Note", "26.21"],
    ["CPP 26.21.01 Hotfix", "26.21.01"],
    ["CPP 26.21.02 Crime release", "26.21.02"],
  ])("extracts a release version from %s", (title, expected) => {
    expect(parseReleaseVersion(title)).toBe(expected);
  });

  test("includes patch releases but excludes similar release numbers", () => {
    expect(belongsToReleaseFamily("26.21", "26.21")).toBe(true);
    expect(belongsToReleaseFamily("26.21.02", "26.21")).toBe(true);
    expect(belongsToReleaseFamily("26.210", "26.21")).toBe(false);
    expect(belongsToReleaseFamily("26.22", "26.21")).toBe(false);
  });

  test("sorts patch versions numerically", () => {
    expect(
      ["26.21.10", "26.21", "26.21.02"].sort(compareReleaseVersions),
    ).toEqual(["26.21", "26.21.02", "26.21.10"]);
  });

  test("turns rendered Confluence HTML into compact text", () => {
    expect(confluenceHtmlToText("<h1>Changes</h1><p>A &amp; B</p>")).toBe(
      "Changes A & B",
    );
  });

  test("finds a linked technical release page for the requested family", () => {
    const html = `
      <a href="/confluence/spaces/CROWN/pages/1990374280/CCT+Release+26.22+-+Tech+Focused+-+Main+Release">
        CCT Release 26.22 - Tech Focused
      </a>
      <a href="/confluence/spaces/CROWN/pages/111/CCT+Release+26.23">Other release</a>`;

    expect(extractLinkedReleasePageIds(html, "26.22")).toEqual(["1990374280"]);
  });

  test("finds legacy viewpage links and removes duplicates", () => {
    const html = `
      <a href="/confluence/pages/viewpage.action?pageId=42">CCT 26.22 release</a>
      <a href="/confluence/pages/viewpage.action?pageId=42&amp;x=1">26.22 tech focused</a>`;

    expect(extractLinkedReleasePageIds(html, "26.22")).toEqual(["42"]);
  });
});
