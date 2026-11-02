// Gather everything the screen needs for one local moment.
import { fetchCalendars } from "./data/calendar.mjs";
import { fetchWeather } from "./data/weather.mjs";
import { sunTimes } from "./data/sun.mjs";
import { travelTo } from "./data/travel.mjs";
import { fakeDay } from "./data/fixtures.mjs";
import { plantState } from "./plants.mjs";
import { state } from "./state.mjs";
import { mins } from "./time.mjs";

const settle = async (p, label, errors) => { try { return await p; } catch (e) { errors.push(`${label}: ${e.message}`); return null; } };

/**
 * @param {{date, hhmm}} at  local moment
 * @param {{fake?: boolean, claimNotes?: boolean}} opts
 */
// Calendar blocks that aren't events: "Travel", "No call day", focus/hold blocks.
// They stay off the screen entirely (Sonnet is told the same in its prompt).
const PLACEHOLDER = /^\s*(travel|commute|no[- ]?calls?( day)?|no[- ]?meetings?( day)?|focus( time| block)?|hold|block(ed)?|busy|ooo|out of office|do not book|dnb)\s*$/i;
export const isPlaceholder = (e) => PLACEHOLDER.test(e.title || "");

export async function gatherDay(at, { fake = process.env.INKY_FAKE === "1", claimNotes = false, peekNotes = false } = {}) {
  const day = at.date;
  const errors = [];
  let weather, calendar, sun, travel;
  if (fake) ({ weather, calendar, sun, travel } = fakeDay(day));
  else {
    [weather, calendar] = await Promise.all([settle(fetchWeather(day), "weather", errors), settle(fetchCalendars(day), "calendar", errors)]);
    calendar ||= { events: [], allDay: [], ok: false };
    calendar = { ...calendar, events: calendar.events.filter((e) => !isPlaceholder(e)), allDay: (calendar.allDay || []).filter((e) => !isPlaceholder(e)) };
    if (calendar.errors?.length) errors.push(...calendar.errors.map((e) => `calendar ${e}`));
    sun = sunTimes(day);
    const firstPhysical = calendar.events.find((e) => e.physical && mins(e.start) >= mins(at.hhmm));
    travel = firstPhysical ? await settle(travelTo(firstPhysical, { now: at.hhmm }), "travel", errors) : null;
  }

  const upcoming = calendar.events.filter((e) => mins(e.end) > mins(at.hhmm));
  const next = upcoming.find((e) => mins(e.start) >= mins(at.hhmm)) || upcoming[0] || null;

  const plants = plantState(day, await state.getLastWatered(), process.env.PLANTS_FIRST_DUE || null);
  // claim: the morning composition takes every waiting note. peek: previews show
  // waiting notes without taking them. Otherwise: whatever this morning claimed.
  const notes = claimNotes ? await state.claimNotes(day)
    : peekNotes ? (await state.listNotes()).filter((n) => !n.shownOn || n.shownOn === day)
    : await state.notesFor(day);

  return {
    at, day,
    place: process.env.HOME_PLACE || "Brooklyn",
    weather, calendar, sun, travel, plants,
    next: next && { ...next, inMinutes: Math.max(0, mins(next.start) - mins(at.hhmm)) },
    notes: notes.map((n) => ({ text: n.text, from: n.from, at: n.at })),
    errors,
  };
}
