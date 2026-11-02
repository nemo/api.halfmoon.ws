// Wall-clock helpers pinned to the device's timezone. Everything in the inky
// service talks in local "YYYY-MM-DD" dates and "HH:MM" times.

export const TZ = process.env.INKY_TZ || "America/New_York";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Date -> { date: "2026-11-02", hhmm: "06:40" } in TZ */
export function local(d = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour}:${p.minute}` };
}

export const mins = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

/** Calendar arithmetic on "YYYY-MM-DD" strings (UTC-noon based, DST-proof). */
export const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const diffDays = (a, b) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 864e5);
export const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 Sun .. 6 Sat

/** The UTC instant of local wall time `date hh:mm` in TZ. */
export function instant(date, hhmm = "00:00") {
  const guess = Date.parse(`${date}T${hhmm}:00Z`);
  // offset = local(guess) - guess; correct twice to settle across DST edges
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const l = local(new Date(t));
    const asUtc = Date.parse(`${l.date}T${l.hhmm}:00Z`);
    t += guess - asUtc;
  }
  return new Date(t);
}

export const MORNING_START = "04:00";
export const MORNING_END = "11:00";

/**
 * Which screen is live at a local moment, and which day it belongs to.
 * Ambient runs 11:00 -> 04:00 and belongs to the day it started on.
 */
export function phase({ date, hhmm }) {
  const m = mins(hhmm);
  if (m >= mins(MORNING_START) && m < mins(MORNING_END)) return { mode: "morning", day: date };
  return { mode: "ambient", day: m < mins(MORNING_START) ? addDays(date, -1) : date };
}
