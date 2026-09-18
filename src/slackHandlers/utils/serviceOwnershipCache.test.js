jest.mock("cajache", () => ({ use: jest.fn((key, handler) => handler()) }));
jest.mock("../../ai/ai", () => ({ identifyServiceOwnership: jest.fn() }));

const { identifyServiceOwnership } = require("../../ai/ai");
const {
  getServiceOwnershipCacheKey,
  identifyServiceOwnershipCached,
} = require("./serviceOwnershipCache");

describe("service ownership cache", () => {
  const catalogue = { id: "1", updated: "2026-03-12" };

  test("changes when catalogue revision or incident context changes", () => {
    const original = getServiceOwnershipCacheKey(catalogue, "listing fails");
    expect(getServiceOwnershipCacheKey(catalogue, "hearing fails")).not.toBe(
      original,
    );
    expect(
      getServiceOwnershipCacheKey(
        { ...catalogue, updated: "2026-03-13" },
        "listing fails",
      ),
    ).not.toBe(original);
  });

  test("passes catalogue and incident context to the ownership matcher", async () => {
    identifyServiceOwnership.mockResolvedValue({ owningTeam: "Listing" });
    await identifyServiceOwnershipCached(catalogue, "listing fails");
    expect(identifyServiceOwnership).toHaveBeenCalledWith(
      "listing fails",
      catalogue,
    );
  });
});
