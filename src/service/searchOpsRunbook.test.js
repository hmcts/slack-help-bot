const mockSearch = jest.fn();

jest.mock("@azure/search-documents", () => ({
  SearchClient: jest.fn().mockImplementation(() => ({
    search: mockSearch,
  })),
}));

jest.mock("@azure/identity", () => ({
  DefaultAzureCredential: jest.fn(),
}));

const { searchOpsRunbook } = require("./searchOpsRunbook");

describe("searchOpsRunbook", () => {
  beforeEach(() => {
    mockSearch.mockReset();
  });

  it("uses semantic config for ops-runbook index", async () => {
    mockSearch.mockResolvedValue({ results: [] });

    await searchOpsRunbook("aks dns issue");

    expect(mockSearch).toHaveBeenCalledWith(
      "aks dns issue",
      expect.objectContaining({
        queryType: "semantic",
        semanticSearchOptions: expect.objectContaining({
          configurationName: "ops-runbook",
        }),
      }),
    );
  });
});
