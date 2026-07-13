jest.mock("../../service/searchHelpRequests", () => ({
  searchHelpRequests: jest.fn(),
}));

jest.mock("../../service/searchKnowledgeStore", () => ({
  searchKnowledgeStore: jest.fn(),
}));

jest.mock("../../ai/ai", () => ({
  analyticsRecommendations: jest.fn(),
  followUpQuestions: jest.fn(),
}));

const { searchHelpRequests } = require("../../service/searchHelpRequests");
const { searchKnowledgeStore } = require("../../service/searchKnowledgeStore");
const { analyticsRecommendations, followUpQuestions } = require("../../ai/ai");
const { queryAi } = require("./aiCache");

describe("queryAi", () => {
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
});
