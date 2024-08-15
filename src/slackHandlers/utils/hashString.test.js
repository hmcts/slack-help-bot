const { hashString } = require("./hashString.js");

describe("hashString", () => {
  it("hashes to expected value", () => {
    expect(hashString("My VPN won't connect")).toBe(
      "f4ecf6b6093414ebea8f939cd181e2726431f66658d9081bc656d3d035ffe91d",
    );
  });
});
