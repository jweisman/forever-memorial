import { HDate } from "@hebcal/core";

/**
 * Convert a Gregorian death date to a formatted Hebrew calendar date string.
 * If afterSunset is true, the Hebrew day is advanced by one (since the Jewish
 * day begins at sunset, a death after sunset falls on the next Hebrew date).
 */
export function getHebrewDeathDate(
  dateOfDeath: Date,
  afterSunset: boolean,
  locale: "en" | "he" = "en"
): string {
  let hd = new HDate(new Date(dateOfDeath));
  if (afterSunset) hd = hd.next();
  if (locale === "he") return hd.renderGematriya(true);
  return hd.render(locale);
}
