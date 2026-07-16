const mockSearch = jest.fn();

jest.mock("@azure/search-documents", () => ({
  SearchClient: jest.fn().mockImplementation(() => ({
    search: mockSearch,
  })),
}));

jest.mock("@azure/identity", () => ({
  DefaultAzureCredential: jest.fn(),
}));

const { searchKnowledgeStore } = require("./searchKnowledgeStore");

describe("searchKnowledgeStore", () => {
  beforeEach(() => {
    mockSearch.mockReset();
  });

  it("limits the docs search to cloud native platform docs for other", async () => {
    mockSearch.mockResolvedValue({ results: [] });

    await searchKnowledgeStore("github access", "other");

    expect(mockSearch).toHaveBeenCalledWith(
      "github access",
      expect.objectContaining({
        filter:
          "search.ismatch('\"cloud-native-platform\"', 'metadata_storage_path')",
      }),
    );
  });

  it("limits the docs search to common platform docs for crime", async () => {
    mockSearch.mockResolvedValue({ results: [] });

    await searchKnowledgeStore("github access", "crime");

    expect(mockSearch).toHaveBeenCalledWith(
      "github access",
      expect.objectContaining({
        filter:
          "search.ismatch('\"common-platform\"', 'metadata_storage_path')",
      }),
    );
  });

  it("searches the whole docs index when the area is not recognised", async () => {
    mockSearch.mockResolvedValue({ results: [] });

    await searchKnowledgeStore("github access", undefined);

    expect(mockSearch).toHaveBeenCalledWith(
      "github access",
      expect.not.objectContaining({
        filter: expect.any(String),
      }),
    );
  });
});
