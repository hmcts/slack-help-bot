const { truncateUtf8Bytes } = require("./cosmos");

describe("truncateUtf8Bytes", () => {
  it("leaves short strings unchanged", () => {
    expect(truncateUtf8Bytes("short description", 100)).toBe(
      "short description",
    );
  });

  it("truncates strings by UTF-8 byte length", () => {
    expect(truncateUtf8Bytes("abcdefghij", 6)).toBe("abcdef");
  });

  it("does not split multibyte characters", () => {
    const result = truncateUtf8Bytes("abc😀def", 7);

    expect(result).toBe("abc😀");
    expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(7);
  });

  it("returns non-string values unchanged", () => {
    expect(truncateUtf8Bytes(undefined, 10)).toBe(undefined);
    expect(truncateUtf8Bytes(null, 10)).toBe(null);
  });
});
