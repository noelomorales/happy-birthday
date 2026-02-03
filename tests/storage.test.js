const { getStorageKey, normalizeMode } = require("../script.js");

describe("storage helpers", () => {
  test("normalizeMode defaults to live", () => {
    expect(normalizeMode("live")).toBe("live");
    expect(normalizeMode("test")).toBe("test");
    expect(normalizeMode("unknown")).toBe("live");
  });

  test("getStorageKey namespaces test data", () => {
    expect(getStorageKey("commute-tracker-history", "live")).toBe(
      "commute-tracker-history"
    );
    expect(getStorageKey("commute-tracker-history", "test")).toBe(
      "commute-tracker-history-test"
    );
  });
});
