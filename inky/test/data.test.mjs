import { test } from "node:test";
import assert from "node:assert/strict";
import ical from "node-ical";
import { eventsForDay, parseSources, isPhysical } from "../data/calendar.mjs";
import { shapeWeather } from "../data/weather.mjs";
import { instant } from "../time.mjs";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:me@example.com
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:STANDARD
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:standup
DTSTART;TZID=America/New_York:20261005T093000
DTEND;TZID=America/New_York:20261005T100000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE
SUMMARY:Standup
LOCATION:https://zoom.us/j/1
END:VEVENT
BEGIN:VEVENT
UID:declined
DTSTART;TZID=America/New_York:20261102T110000
DTEND;TZID=America/New_York:20261102T120000
SUMMARY:Optional sync
ATTENDEE;PARTSTAT=DECLINED:mailto:me@example.com
END:VEVENT
BEGIN:VEVENT
UID:lunch
DTSTART;TZID=America/New_York:20261102T130000
DTEND;TZID=America/New_York:20261102T140000
SUMMARY:Lunch with Sam
LOCATION:Walter's, 166 DeKalb Ave, Brooklyn
END:VEVENT
BEGIN:VEVENT
UID:ooo
DTSTART;VALUE=DATE:20261102
DTEND;VALUE=DATE:20261103
SUMMARY:Alex OOO
ORGANIZER:mailto:alex@example.com
END:VEVENT
BEGIN:VEVENT
UID:tomorrow
DTSTART;TZID=America/New_York:20261103T090000
DTEND;TZID=America/New_York:20261103T100000
SUMMARY:Tomorrow thing
END:VEVENT
END:VCALENDAR`;

test("ICAL_URLS parsing", () => {
  assert.deepEqual(parseSources("work|https://a, personal|https://b ,https://c"), [
    { tag: "work", url: "https://a" }, { tag: "personal", url: "https://b" }, { tag: "work", url: "https://c" },
  ]);
});

test("today's events: recurrence expanded, declined and others' OOO dropped", () => {
  const parsed = ical.sync.parseICS(ICS);
  const evs = eventsForDay([{ tag: "work", parsed }, { tag: "personal", parsed }], "2026-11-02");
  assert.deepEqual(evs.map((e) => [e.start, e.title, e.physical]), [
    ["09:30", "Standup", false],
    ["13:00", "Lunch with Sam", true],
  ]);
  assert.equal(evs[0].personal, false); // de-duped to the first source
});

test("isPhysical", () => {
  assert.equal(isPhysical("Zoom"), false);
  assert.equal(isPhysical("https://meet.google.com/x"), false);
  assert.equal(isPhysical("Industry City, Brooklyn"), true);
});

test("weather: hourly interpolation, hi/lo, rain windows", () => {
  const day = "2026-11-02";
  const ts = (hh) => instant(day, hh).getTime() / 1000;
  const current = { dt: ts("06:30"), main: { temp: 47.4 }, weather: [{ main: "Rain" }] };
  const forecast = { list: [
    ["09:00", 50, 0.9], ["12:00", 55, 0.6], ["15:00", 57, 0.1], ["18:00", 52, 0], ["21:00", 48, 0],
  ].map(([hh, temp, pop]) => ({ dt: ts(hh), main: { temp }, pop, weather: [{ main: pop > 0.4 ? "Rain" : "Clouds" }] })) };
  const w = shapeWeather(current, forecast, day);
  assert.equal(w.hours.length, 17);
  assert.equal(w.hours[0].h, 6);
  assert.equal(w.now, 47);
  assert.equal(w.hi, 57);
  assert.equal(w.condition, "Rain");
  assert.equal(w.summary, "Rain 6am to 2pm");
});
