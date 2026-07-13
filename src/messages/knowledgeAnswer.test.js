const {
  convertMarkdownToSlackMrkdwn,
  getKnowledgeStoreSource,
  getSourceResults,
  knowledgeAnswerText,
  removeHelpGuidance,
} = require("./knowledgeAnswer");

describe("getKnowledgeStoreSource", () => {
  it("formats a HMCTS Way storage path as a Slack link", () => {
    const item = {
      document: {
        title: "Creating a GitHub repo",
        metadata_storage_path:
          "https://sttimslackbo570094706456.blob.core.windows.net/the-hmcts-way/cloud-native-platform/new-component/github-repo.html",
      },
    };

    expect(getKnowledgeStoreSource(item, 0)).toBe(
      "<https://hmcts.github.io/cloud-native-platform/new-component/github-repo.html|1. Creating a GitHub repo>",
    );
  });

  it("falls back to plain text when the source path is missing", () => {
    expect(
      getKnowledgeStoreSource({ document: { title: "Missing path" } }, 1),
    ).toBe("2. Missing path");
  });
});

describe("knowledgeAnswerText", () => {
  it("includes answer, sources and the help CTA", () => {
    const text = knowledgeAnswerText({
      answer: "Use the GitHub repo creation guide [1].",
      knowledgeStoreResults: [
        {
          document: {
            title: "Creating a GitHub repo",
            metadata_storage_path:
              "https://sttimslackbo570094706456.blob.core.windows.net/the-hmcts-way/cloud-native-platform/new-component/github-repo.html",
            content: "Full document content",
          },
        },
      ],
    });

    expect(text).toContain("Use the GitHub repo creation guide [1].");
    expect(text).toContain("*Sources*");
    expect(text).toContain("Creating a GitHub repo");
    expect(text).toContain('Reply with "help"');
  });

  it("only includes source indexes used by the answer", () => {
    const text = knowledgeAnswerText({
      answer: "Use the troubleshooting guide [2].",
      sourceIndexes: [2],
      knowledgeStoreResults: [
        {
          document: {
            title: "Unrelated",
            metadata_storage_path:
              "https://sttimslackbo570094706456.blob.core.windows.net/the-hmcts-way/unrelated.html",
          },
        },
        {
          document: {
            title: "Troubleshooting issues",
            metadata_storage_path:
              "https://sttimslackbo570094706456.blob.core.windows.net/the-hmcts-way/troubleshooting.html",
          },
        },
      ],
    });

    expect(text).toContain("2. Troubleshooting issues");
    expect(text).not.toContain("1. Unrelated");
  });

  it("does not include sources when no source indexes are used", () => {
    const text = knowledgeAnswerText({
      answer: "I couldn't find an answer in the documentation.",
      sourceIndexes: [],
      knowledgeStoreResults: [
        {
          document: {
            title: "Troubleshooting issues",
          },
        },
      ],
    });

    expect(text).not.toContain("*Sources*");
  });

  it("converts generated markdown bold to Slack mrkdwn", () => {
    const text = knowledgeAnswerText({
      answer: "1. **Check Jenkins Availability**: Ensure Jenkins is available.",
      knowledgeStoreResults: [],
    });

    expect(text).toContain(
      "1. *Check Jenkins Availability*: Ensure Jenkins is available.",
    );
    expect(text).not.toContain("**Check Jenkins Availability**");
  });

  it("includes related JIRA issues with their resolutions", () => {
    const text = knowledgeAnswerText({
      answer: "Use the runbook.",
      knowledgeStoreResults: [],
      relatedIssues: [
        {
          key: "SBOX-1",
          title: "Smoke / Functional test failure",
          resolution: "Access the URL on VPN and run the tests manually.",
        },
      ],
    });

    expect(text).toContain("*Related JIRA issues*");
    expect(text).toContain("SBOX-1");
    expect(text).toContain("Smoke / Functional test failure");
    expect(text).toContain("Access the URL on VPN");
  });
});

describe("removeHelpGuidance", () => {
  it("removes generated help guidance", () => {
    expect(
      removeHelpGuidance(
        'I could not find that in the documentation. You can reply with "help" to raise a Platform Operations help request.',
      ),
    ).toBe("I could not find that in the documentation.");
  });
});

describe("convertMarkdownToSlackMrkdwn", () => {
  it("converts double asterisk bold to Slack bold", () => {
    expect(convertMarkdownToSlackMrkdwn("Use **Jenkins** first")).toBe(
      "Use *Jenkins* first",
    );
  });

  it("converts double underscore bold to Slack bold", () => {
    expect(convertMarkdownToSlackMrkdwn("Use __Jenkins__ first")).toBe(
      "Use *Jenkins* first",
    );
  });
});

describe("getSourceResults", () => {
  it("returns all sources when source indexes are not supplied", () => {
    expect(getSourceResults(["a", "b"])).toStrictEqual([
      { item: "a", index: 0 },
      { item: "b", index: 1 },
    ]);
  });

  it("returns selected one-based source indexes", () => {
    expect(getSourceResults(["a", "b"], [2])).toStrictEqual([
      { item: "b", index: 1 },
    ]);
  });
});
