jest.mock("../../service/searchHelpRequests", () => ({
  searchHelpRequests: jest.fn(),
}));

jest.mock("../../service/searchKnowledgeStore", () => ({
  searchKnowledgeStore: jest.fn(),
}));

jest.mock("../../ai/ai", () => ({
  analyticsRecommendations: jest.fn(),
  followUpQuestions: jest.fn(),
  assessPriority: jest.fn(),
}));

const { searchHelpRequests } = require("../../service/searchHelpRequests");
const { searchKnowledgeStore } = require("../../service/searchKnowledgeStore");
const {
  analyticsRecommendations,
  followUpQuestions,
  assessPriority,
} = require("../../ai/ai");
const { queryAi } = require("./aiCache");

describe("queryAi", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns related help request results from the search index", async () => {
    searchHelpRequests.mockResolvedValue([
      {
        key: "SBOX-1",
        title: "Issue one",
        resolution: "Restarted the pods after adding the missing secret.",
      },
    ]);
    searchKnowledgeStore.mockResolvedValue([]);
    analyticsRecommendations.mockResolvedValue({});
    followUpQuestions.mockResolvedValue([]);
    assessPriority.mockResolvedValue({
      priority: "normal",
      confidence: "high",
      reasons: [],
    });

    const result = await queryAi(
      {
        summary: "Functional test failing",
        description: "The build is failing",
        analysis: "",
        prBuildUrl: "",
      },
      "other",
    );

    expect(result.relatedIssues).toStrictEqual([
      {
        key: "SBOX-1",
        title: "Issue one",
        resolution: "Restarted the pods after adding the missing secret.",
      },
    ]);
  });

  it("does not search the knowledge store when skipKnowledgeStore is enabled", async () => {
    searchHelpRequests.mockResolvedValue([]);
    analyticsRecommendations.mockResolvedValue({});
    followUpQuestions.mockResolvedValue([]);
    assessPriority.mockResolvedValue({
      priority: "normal",
      confidence: "high",
      reasons: [],
    });

    const result = await queryAi(
      {
        summary: "Preview deployment failing",
        description: "The original DM was already searched in documentation",
        analysis: "",
        prBuildUrl: "",
      },
      "other",
      { skipKnowledgeStore: true },
    );

    expect(searchKnowledgeStore).not.toHaveBeenCalled();
    expect(result.knowledgeStoreResults).toStrictEqual([]);
  });
});
