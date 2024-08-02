const {
  convertIso8601ToEpochSeconds,
  extractSlackLinkFromText,
  extractSlackMessageIdFromText,
  convertStoragePathToHmctsWayUrl,
  extractKnowledgeStoreHighlight,
} = require("./util");

describe("convertIso8601ToEpochSeconds", () => {
  it("returns undefined if undefined", () => {
    expect(convertIso8601ToEpochSeconds(undefined)).toBe(undefined);
  });
  it("converts iso time to epoch second", () => {
    expect(convertIso8601ToEpochSeconds("2021-01-26T12:00:20.000+0000")).toBe(
      1611662420,
    );
  });
});

describe("convertStoragePathToHmctsWayUrl", () => {
  it("converts path to expected format", () => {
    const storagePath =
      "https://sttimslackbo570094706456.blob.core.windows.net/the-hmcts-way/cloud-native-platform/new-component/github-repo.html";
    expect(convertStoragePathToHmctsWayUrl(storagePath)).toBe(
      "https://hmcts.github.io/cloud-native-platform/new-component/github-repo.html",
    );
  });
});

describe("extractKnowledgeStoreHighlight", () => {
  it("highlights simple markup", () => {
    const item = {
      captions: [
        {
          highlights: "<em>hello world</em>",
        },
      ],
    };
    expect(extractKnowledgeStoreHighlight(item)).toBe("`hello world`");
  });

  it("handles spaces before and after", () => {
    const item = {
      captions: [
        {
          highlights: "john<em> hello world</em> boy <em> world</em>",
        },
      ],
    };
    expect(extractKnowledgeStoreHighlight(item)).toBe(
      "john `hello world` boy `world`",
    );
  });
});

describe("extractSlackLinkFromText", () => {
  it("returns undefined when undefined", () => {
    expect(extractSlackLinkFromText(undefined)).toBe(undefined);
  });
  it("returns undefined when no match", () => {
    expect(extractSlackLinkFromText("hello world")).toBe(undefined);
  });
  it("returns slack message link when found", () => {
    expect(
      extractSlackLinkFromText(
        "h6. _This is an automatically generated ticket created from Slack, do not reply or update in here, [view in Slack|https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611568116006500]_",
      ),
    ).toBe(
      "https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611568116006500",
    );
  });
});

describe("extractSlackMessageIdFromText", () => {
  it("returns undefined when undefined", () => {
    expect(extractSlackMessageIdFromText(undefined)).toBe(undefined);
  });
  it("returns undefined when no match", () => {
    expect(extractSlackMessageIdFromText("hello world")).toBe(undefined);
  });

  //TODO: find way to get this to pass locally
  it("returns slack message id when found", () => {
    expect(
      extractSlackMessageIdFromText(
        "*<https://platformengin-tzf2541.slack.com/archives/C01KHKNJUKE/p1611568116006500|Dummy>*\n",
      ),
    ).toBe("p1611568116006500");
  });
});
