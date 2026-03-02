import { HDate } from "@hebcal/core";

export type YahrzeitEntry = {
  hebrewYear: number;
  hebrewDate: string;
  gregorianDate: Date;
};

/**
 * Calculate the Gregorian dates for the next `count` yahrzeit anniversaries.
 * If afterSunset is true, the Hebrew date is advanced by one day (death after
 * sunset = next Jewish day).
 */
export function getYahrzeitDates(
  dateOfDeath: Date,
  afterSunset: boolean,
  count = 15
): YahrzeitEntry[] {
  let hd = new HDate(new Date(dateOfDeath));
  if (afterSunset) hd = hd.next();

  const month = hd.getMonth();
  const day = hd.getDate();
  const startHebrewYear = hd.getFullYear() + 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results: YahrzeitEntry[] = [];
  let year = startHebrewYear;
  while (results.length < count) {
    const yahrzeitHDate = new HDate(day, month, year);
    const gregorianDate = yahrzeitHDate.greg();
    if (gregorianDate >= today) {
      results.push({
        hebrewYear: year,
        hebrewDate: yahrzeitHDate.render("en"),
        gregorianDate,
      });
    }
    year++;
  }

  return results;
}
