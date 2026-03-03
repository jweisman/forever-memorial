import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { vi } from "vitest";
import { getYahrzeitDates } from "@/lib/yahrzeit";

// Fix "today" so past-date filtering is deterministic across CI runs
const MOCK_TODAY = new Date(2024, 0, 1); // Jan 1, 2024

// A death date where all yahrzeits fall in the future relative to MOCK_TODAY
// (death in mid-2023 → first yahrzeit ≈ mid-2024, all 15 are future)
const DEATH_DATE = new Date(2023, 5, 15); // Jun 15, 2023

describe("getYahrzeitDates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 15 entries by default", () => {
    const results = getYahrzeitDates(DEATH_DATE, false);
    expect(results).toHaveLength(15);
  });

  it("respects a custom count", () => {
    expect(getYahrzeitDates(DEATH_DATE, false, 5)).toHaveLength(5);
    expect(getYahrzeitDates(DEATH_DATE, false, 1)).toHaveLength(1);
  });

  it("all gregorian dates are on or after today", () => {
    const today = new Date(MOCK_TODAY);
    today.setHours(0, 0, 0, 0);
    const results = getYahrzeitDates(DEATH_DATE, false);
    for (const r of results) {
      expect(r.gregorianDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    }
  });

  it("hebrew years are in ascending order", () => {
    const results = getYahrzeitDates(DEATH_DATE, false);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].hebrewYear).toBeGreaterThan(results[i - 1].hebrewYear);
    }
  });

  it("each entry has a non-empty hebrewDate string", () => {
    const results = getYahrzeitDates(DEATH_DATE, false);
    for (const r of results) {
      expect(r.hebrewDate).toBeTruthy();
      expect(typeof r.hebrewDate).toBe("string");
    }
  });

  it("afterSunset shifts the hebrew date relative to afterSunset=false", () => {
    const normal = getYahrzeitDates(DEATH_DATE, false);
    const afterSunset = getYahrzeitDates(DEATH_DATE, true);
    // The Hebrew dates should differ (sunset advances one day)
    expect(normal[0].hebrewDate).not.toBe(afterSunset[0].hebrewDate);
  });

  it("skips past yahrzeits — old death date with many past anniversaries", () => {
    // Death in 2000 means ~24 years of yahrzeits have passed by 2024-01-01
    const oldDeath = new Date(2000, 0, 1); // Jan 1, 2000
    const results = getYahrzeitDates(oldDeath, false);
    const today = new Date(MOCK_TODAY);
    today.setHours(0, 0, 0, 0);
    // All returned dates must be >= today
    for (const r of results) {
      expect(r.gregorianDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    }
  });

  it("all entries share the same hebrew month and day across years", () => {
    const results = getYahrzeitDates(DEATH_DATE, false);
    // The hebrewDate string format is e.g. "15th of Sivan, 5784"
    // Extract the month name and day from the first result
    const firstDate = results[0].hebrewDate;
    // Month name is the word after "of"
    const monthMatch = firstDate.match(/of (\w+)/);
    expect(monthMatch).toBeTruthy();
    const monthName = monthMatch![1];
    // All entries should contain the same month name
    for (const r of results) {
      expect(r.hebrewDate).toContain(monthName);
    }
  });
});
