const { formatDelta, formatDuration } = require("../script.js");

describe("time formatting helpers", () => {
  test("formatDelta returns on time for zero offset", () => {
    const expected = new Date("2025-01-01T08:00:00Z");
    const actual = new Date("2025-01-01T08:00:00Z");
    expect(formatDelta(expected, actual)).toBe("On time");
  });

  test("formatDelta returns signed minutes", () => {
    const expected = new Date("2025-01-01T08:00:00Z");
    const late = new Date("2025-01-01T08:06:00Z");
    const early = new Date("2025-01-01T07:52:00Z");
    expect(formatDelta(expected, late)).toBe("+6m");
    expect(formatDelta(expected, early)).toBe("-8m");
  });

  test("formatDuration returns hours and minutes", () => {
    const start = new Date("2025-01-01T08:00:00Z");
    const end = new Date("2025-01-01T09:12:00Z");
    expect(formatDuration(start, end)).toBe("1h 12m");
  });
});
