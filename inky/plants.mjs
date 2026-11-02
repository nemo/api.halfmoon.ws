// The weekly watering reminder. Pure date logic, no I/O.
//
//   due        = last watered + 7 days
//   weekend    = due falls on Sat/Sun: shown from the Friday before
//   upcoming   = shown the day before due
//   due        = the day itself
//   overdue    = every day after, escalating (daysLate 1..3 on screen)
//   done       = the day of watering and the day after, as a quiet confirmation
//   null       = nothing to show
// Watering on any day resets the cycle from that day.

import { addDays, diffDays, weekday } from "./time.mjs";

export const INTERVAL = 7;

export function nextDue(lastWatered, firstDue) {
  if (lastWatered) return addDays(lastWatered, INTERVAL);
  return firstDue || null;
}

/**
 * @param {string} today        "YYYY-MM-DD"
 * @param {string|null} lastWatered
 * @param {string|null} firstDue used before the first press (defaults to today)
 * @returns {null | {state, due, daysLate?, wateredOn?}}
 */
export function plantState(today, lastWatered, firstDue = null) {
  const due = nextDue(lastWatered, firstDue) || today;
  const until = diffDays(due, today);

  if (until < 0) return { state: "overdue", due, daysLate: Math.min(3, -until), daysLateActual: -until };
  if (until === 0) return { state: "due", due };

  const dow = weekday(due);
  if (dow === 6 || dow === 0) {
    const friday = addDays(due, dow === 6 ? -1 : -2);
    if (diffDays(today, friday) >= 0) return { state: "weekend", due };
  } else if (until === 1) {
    return { state: "upcoming", due };
  }

  if (lastWatered && diffDays(today, lastWatered) <= 1) {
    const wateredOn = diffDays(today, lastWatered) === 0
      ? "today"
      : new Date(`${lastWatered}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    return { state: "done", due, wateredOn };
  }
  return null;
}
