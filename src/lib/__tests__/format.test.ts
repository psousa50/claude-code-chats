import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseTimestamp,
  formatRelativeTime,
  formatDateTime,
  formatTokenCount,
  encodeProjectPath,
} from "../format";

describe("parseTimestamp", () => {
  it("returns number input unchanged", () => {
    expect(parseTimestamp(1700000000000)).toBe(1700000000000);
  });

  it("parses ISO string to epoch ms", () => {
    expect(parseTimestamp("2024-01-15T10:30:00Z")).toBe(1705314600000);
  });

  it("returns 0 for invalid string", () => {
    expect(parseTimestamp("not-a-date")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseTimestamp("")).toBe(0);
  });

  it("returns 0 for zero", () => {
    expect(parseTimestamp(0)).toBe(0);
  });
});

describe("formatRelativeTime", () => {
  const NOW = new Date("2026-06-15T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Just now' for current timestamp", () => {
    expect(formatRelativeTime(NOW)).toBe("Just now");
  });

  it("returns 'Just now' for 30 seconds ago", () => {
    expect(formatRelativeTime(NOW - 30_000)).toBe("Just now");
  });

  it("returns minutes for 1-59 minutes ago", () => {
    expect(formatRelativeTime(NOW - 60_000)).toBe("1m ago");
    expect(formatRelativeTime(NOW - 5 * 60_000)).toBe("5m ago");
    expect(formatRelativeTime(NOW - 59 * 60_000)).toBe("59m ago");
  });

  it("returns hours for 1-23 hours ago", () => {
    expect(formatRelativeTime(NOW - 3_600_000)).toBe("1h ago");
    expect(formatRelativeTime(NOW - 12 * 3_600_000)).toBe("12h ago");
    expect(formatRelativeTime(NOW - 23 * 3_600_000)).toBe("23h ago");
  });

  it("returns days for 1-6 days ago", () => {
    expect(formatRelativeTime(NOW - 86_400_000)).toBe("1d ago");
    expect(formatRelativeTime(NOW - 6 * 86_400_000)).toBe("6d ago");
  });

  it("returns weeks for 7-29 days ago", () => {
    expect(formatRelativeTime(NOW - 7 * 86_400_000)).toBe("1w ago");
    expect(formatRelativeTime(NOW - 14 * 86_400_000)).toBe("2w ago");
    expect(formatRelativeTime(NOW - 28 * 86_400_000)).toBe("4w ago");
  });

  it("returns months for 30-364 days ago", () => {
    expect(formatRelativeTime(NOW - 30 * 86_400_000)).toBe("1mo ago");
    expect(formatRelativeTime(NOW - 90 * 86_400_000)).toBe("3mo ago");
  });

  it("returns years for 365+ days ago", () => {
    expect(formatRelativeTime(NOW - 365 * 86_400_000)).toBe("1y ago");
    expect(formatRelativeTime(NOW - 730 * 86_400_000)).toBe("2y ago");
  });
});

describe("formatDateTime", () => {
  const originalTZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "UTC";
  });

  afterEach(() => {
    if (originalTZ !== undefined) {
      process.env.TZ = originalTZ;
    } else {
      delete process.env.TZ;
    }
  });

  it("formats ISO string", () => {
    const result = formatDateTime("2026-01-15T14:30:00Z");
    expect(result).toContain("15");
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
    expect(result).toContain("14");
    expect(result).toContain("30");
  });

  it("formats number timestamp", () => {
    const ts = new Date("2026-01-15T14:30:00Z").getTime();
    const result = formatDateTime(ts);
    expect(result).toContain("15");
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
  });
});

describe("formatTokenCount", () => {
  it("formats small numbers with locale separators", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(999)).toBe("999");
  });

  it("formats thousands with locale separators below 10k", () => {
    const result = formatTokenCount(1234);
    expect(result).toMatch(/1[,.]?234/);
  });

  it("formats 10k+ as k", () => {
    expect(formatTokenCount(10_000)).toBe("10.0k");
    expect(formatTokenCount(10_500)).toBe("10.5k");
    expect(formatTokenCount(99_900)).toBe("99.9k");
  });

  it("formats 1M+ as M", () => {
    expect(formatTokenCount(1_000_000)).toBe("1.0M");
    expect(formatTokenCount(1_200_000)).toBe("1.2M");
    expect(formatTokenCount(15_500_000)).toBe("15.5M");
  });
});

describe("encodeProjectPath", () => {
  it("replaces slashes with dashes", () => {
    expect(encodeProjectPath("/Users/foo/bar")).toBe("-Users-foo-bar");
  });

  it("returns unchanged string without slashes", () => {
    expect(encodeProjectPath("no-slashes")).toBe("no-slashes");
  });

  it("handles empty string", () => {
    expect(encodeProjectPath("")).toBe("");
  });

  it("handles trailing slash", () => {
    expect(encodeProjectPath("/foo/")).toBe("-foo-");
  });
});
