import { describe, expect, it, vi } from "vitest";

import { parseRetryAfter } from "./retry-after";

describe("parseRetryAfter", () => {
  it("returns the fallback when header is null", () => {
    expect(parseRetryAfter(null, 2000, 60_000)).toBe(2000);
  });

  it("returns the fallback when header is unparseable", () => {
    expect(parseRetryAfter("not-a-number", 2000, 60_000)).toBe(2000);
  });

  it("parses a delta-seconds value and returns ms", () => {
    expect(parseRetryAfter("30", 2000, 60_000)).toBe(30_000);
  });

  it("clamps a delta-seconds value to max", () => {
    expect(parseRetryAfter("600", 2000, 60_000)).toBe(60_000);
  });

  it("floors a negative delta-seconds value to 0", () => {
    expect(parseRetryAfter("-5", 2000, 60_000)).toBe(0);
  });

  it("parses an HTTP date value relative to now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T12:00:00Z"));

    // Header says "retry at 12:00:20" — that's 20 seconds from "now".
    const result = parseRetryAfter(
      "Thu, 16 Apr 2026 12:00:20 GMT",
      2000,
      60_000,
    );
    expect(result).toBe(20_000);

    vi.useRealTimers();
  });

  it("clamps an HTTP date value to max", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T12:00:00Z"));

    // 10 minutes in the future, but max is 60 seconds.
    const result = parseRetryAfter(
      "Thu, 16 Apr 2026 12:10:00 GMT",
      2000,
      60_000,
    );
    expect(result).toBe(60_000);

    vi.useRealTimers();
  });

  it("floors an HTTP date in the past to 0", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T12:00:00Z"));

    const result = parseRetryAfter(
      "Thu, 16 Apr 2026 11:00:00 GMT",
      2000,
      60_000,
    );
    expect(result).toBe(0);

    vi.useRealTimers();
  });
});
