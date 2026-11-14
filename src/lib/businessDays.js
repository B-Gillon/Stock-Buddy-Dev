// /src/lib/businessDays.js
// Business-day arithmetic for acknowledgement reminders.
// Weekends and the major U.S. holidays below are not counted. Days are counted in Eastern Time.
//
// Holidays (observed date used when the holiday falls on a weekend):
//   New Year's Day, Memorial Day, Independence Day, Labor Day, Thanksgiving Day, Christmas Day.

export const BUSINESS_TIME_ZONE = 'America/New_York';

const pad = (n) => String(n).padStart(2, '0');
const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-based

/** Day of month of the nth (1-based) given weekday (0=Sun) in a month. */
function nthWeekday(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/** Day of month of the last given weekday in a month. */
function lastWeekday(year, month, weekday) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(year, month, lastDay)).getUTCDay();
  return lastDay - ((lastDow - weekday + 7) % 7);
}

/** Fixed-date holiday → the day it is observed (Sat → Fri, Sun → Mon). Returns a Date (UTC midnight). */
function observed(year, month, day) {
  const d = new Date(Date.UTC(year, month, day));
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
  if (dow === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

const holidayCache = new Map();

/** Set of 'YYYY-MM-DD' strings that are holidays in (or observed in) the given year. */
export function holidaysForYear(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const set = new Set();
  const add = (d) => set.add(key(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  add(observed(year, 0, 1));                                        // New Year's Day
  add(observed(year + 1, 0, 1));                                    // next year's New Year's (can be observed Dec 31)
  set.add(key(year, 4, lastWeekday(year, 4, 1)));                   // Memorial Day: last Monday of May
  add(observed(year, 6, 4));                                        // Independence Day
  set.add(key(year, 8, nthWeekday(year, 8, 1, 1)));                 // Labor Day: first Monday of September
  set.add(key(year, 10, nthWeekday(year, 10, 4, 4)));               // Thanksgiving: fourth Thursday of November
  add(observed(year, 11, 25));                                      // Christmas Day

  holidayCache.set(year, set);
  return set;
}

export function isBusinessDay(year, month, day) {
  const dow = new Date(Date.UTC(year, month, day)).getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !holidaysForYear(year).has(key(year, month, day));
}

function localParts(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month - 1, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}

/** Milliseconds the zone is ahead of UTC at a given instant. */
function offsetMs(date, timeZone) {
  const p = localParts(date, timeZone);
  return Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant at which the zone's wall clock reads the given local time. */
function zonedToInstant({ year, month, day, hour, minute, second }, timeZone) {
  const wall = Date.UTC(year, month, day, hour, minute, second);
  let instant = wall - offsetMs(new Date(wall), timeZone);
  instant = wall - offsetMs(new Date(instant), timeZone); // settle across a daylight-saving change
  return new Date(instant);
}

/**
 * The moment `n` business days after `start`, at the same local time of day.
 * Weekends and holidays are skipped; a start on a non-business day counts from the next business day.
 */
export function addBusinessDays(start, n, timeZone = BUSINESS_TIME_ZONE) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const s = localParts(start, timeZone);
  if (count === 0) return new Date(start);

  const d = new Date(Date.UTC(s.year, s.month, s.day));
  let counted = 0;
  while (counted < count) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isBusinessDay(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) counted += 1;
  }
  return zonedToInstant(
    { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), hour: s.hour, minute: s.minute, second: s.second },
    timeZone,
  );
}
