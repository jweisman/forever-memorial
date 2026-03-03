import { describe, it, expect } from "vitest";
import { getHebrewDeathDate } from "@/lib/hebrewDate";

// Rosh Hashana 5785: the Jewish new year begins at sunset Oct 2, 2024.
// Oct 3, 2024 is the first *full* calendar day of 1 Tishrei 5785.
const ROSH_HASHANA_5785 = new Date(2024, 9, 3); // Oct 3, 2024 local time

describe("getHebrewDeathDate", () => {
  it("returns a non-empty string", () => {
    const result = getHebrewDeathDate(ROSH_HASHANA_5785, false);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns a date containing the correct Hebrew month and year for a known date", () => {
    const result = getHebrewDeathDate(ROSH_HASHANA_5785, false, "en");
    // Oct 2, 2024 = 1 Tishrei 5785
    expect(result).toContain("Tishrei");
    expect(result).toContain("5785");
  });

  it("advances the Hebrew date by one day when afterSunset is true", () => {
    const normal = getHebrewDeathDate(ROSH_HASHANA_5785, false, "en");
    const afterSunset = getHebrewDeathDate(ROSH_HASHANA_5785, true, "en");
    // Normal: 1st of Tishrei 5785; after sunset: 2nd of Tishrei 5785
    expect(afterSunset).not.toBe(normal);
    expect(afterSunset).toContain("Tishrei");
    expect(afterSunset).toContain("5785");
  });

  it("returns Hebrew-script text for locale 'he'", () => {
    const result = getHebrewDeathDate(ROSH_HASHANA_5785, false, "he");
    // Hebrew Unicode block: U+05D0–U+05F4
    expect(result).toMatch(/[\u05D0-\u05F4]/);
  });

  it("returns English transliteration for locale 'en'", () => {
    const result = getHebrewDeathDate(ROSH_HASHANA_5785, false, "en");
    // Should not be Hebrew-only; contains ASCII letters
    expect(result).toMatch(/[a-zA-Z]/);
  });

  it("defaults to English locale when locale is omitted", () => {
    const withDefault = getHebrewDeathDate(ROSH_HASHANA_5785, false);
    const withExplicitEn = getHebrewDeathDate(ROSH_HASHANA_5785, false, "en");
    expect(withDefault).toBe(withExplicitEn);
  });

  it("afterSunset false and true produce different month/day for a non-month-boundary date", () => {
    // Jan 15, 2024 — mid-month, so +1 day does not cross a month boundary
    const midMonth = new Date(2024, 0, 15); // Jan 15
    const normal = getHebrewDeathDate(midMonth, false, "en");
    const afterSunset = getHebrewDeathDate(midMonth, true, "en");
    expect(normal).not.toBe(afterSunset);
  });
});
