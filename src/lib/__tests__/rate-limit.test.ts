import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { vi } from "vitest";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

describe("getClientIp", () => {
  it("returns the first IP from x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("trims whitespace from the first x-forwarded-for entry", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "  1.2.3.4  , 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    expect(getClientIp(req)).toBe("9.8.7.6");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const req = new Request("http://localhost");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const req = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
      },
    });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });
});

describe("rateLimit", () => {
  // Use fake timers so Date.now() is controllable
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper: generate a unique key per test to avoid shared state
  const uniqueKey = () => `test-${Math.random().toString(36).slice(2)}`;

  it("allows a request under the limit", () => {
    const result = rateLimit({ key: uniqueKey(), limit: 5, windowMs: 60_000 });
    expect(result.success).toBe(true);
  });

  it("decrements remaining on each successful request", () => {
    const key = uniqueKey();
    expect(rateLimit({ key, limit: 3, windowMs: 60_000 }).remaining).toBe(2);
    expect(rateLimit({ key, limit: 3, windowMs: 60_000 }).remaining).toBe(1);
    expect(rateLimit({ key, limit: 3, windowMs: 60_000 }).remaining).toBe(0);
  });

  it("blocks once the limit is reached", () => {
    const key = uniqueKey();
    rateLimit({ key, limit: 2, windowMs: 60_000 });
    rateLimit({ key, limit: 2, windowMs: 60_000 });
    const result = rateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after the window expires", () => {
    const key = uniqueKey();
    rateLimit({ key, limit: 1, windowMs: 60_000 });
    expect(rateLimit({ key, limit: 1, windowMs: 60_000 }).success).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(60_001);

    expect(rateLimit({ key, limit: 1, windowMs: 60_000 }).success).toBe(true);
  });

  it("does not reset before the window expires", () => {
    const key = uniqueKey();
    rateLimit({ key, limit: 1, windowMs: 60_000 });

    vi.advanceTimersByTime(59_999);

    expect(rateLimit({ key, limit: 1, windowMs: 60_000 }).success).toBe(false);
  });

  it("different keys are rate-limited independently", () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    rateLimit({ key: key1, limit: 1, windowMs: 60_000 });
    rateLimit({ key: key1, limit: 1, windowMs: 60_000 }); // key1 blocked

    // key2 should still be allowed
    expect(rateLimit({ key: key2, limit: 1, windowMs: 60_000 }).success).toBe(
      true
    );
  });
});
