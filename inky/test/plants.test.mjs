import { test } from "node:test";
import assert from "node:assert/strict";
import { plantState, nextDue } from "../plants.mjs";
import { addDays, weekday, phase, instant, local } from "../time.mjs";

// 2026-11-02 is a Monday.
test("calendar helpers", () => {
  assert.equal(weekday("2026-11-02"), 1);
  assert.equal(addDays("2026-11-02", 6), "2026-11-08");
  assert.equal(nextDue("2026-11-02"), "2026-11-09");
});

test("weekday due: quiet until the day before", () => {
  const last = "2026-11-03"; // Tue -> due Tue 11-10
  assert.equal(plantState("2026-11-06", last), null);
  assert.deepEqual(plantState("2026-11-09", last), { state: "upcoming", due: "2026-11-10" });
  assert.deepEqual(plantState("2026-11-10", last), { state: "due", due: "2026-11-10" });
});

test("overdue escalates and caps display at 3", () => {
  const last = "2026-11-03";
  assert.equal(plantState("2026-11-11", last).daysLate, 1);
  assert.equal(plantState("2026-11-12", last).daysLate, 2);
  const late = plantState("2026-11-16", last);
  assert.equal(late.state, "overdue");
  assert.equal(late.daysLate, 3);
  assert.equal(late.daysLateActual, 6);
});

test("Sunday due starts Friday", () => {
  const last = "2026-11-01"; // Sun -> due Sun 11-08
  assert.equal(plantState("2026-11-05", last), null); // Thu
  assert.equal(plantState("2026-11-06", last).state, "weekend"); // Fri
  assert.equal(plantState("2026-11-07", last).state, "weekend"); // Sat
  assert.equal(plantState("2026-11-08", last).state, "due"); // Sun
  assert.equal(plantState("2026-11-09", last).state, "overdue"); // Mon
});

test("Saturday due starts Friday", () => {
  const last = "2026-10-31"; // Sat -> due Sat 11-07
  assert.equal(plantState("2026-11-05", last), null);
  assert.equal(plantState("2026-11-06", last).state, "weekend");
  assert.equal(plantState("2026-11-07", last).state, "due");
});

test("watering resets from the press date and confirms quietly", () => {
  // due Sun 11-08, watered early on Fri 11-06 -> next due Fri 11-13
  const s0 = plantState("2026-11-06", "2026-11-06");
  assert.equal(s0.state, "done");
  assert.equal(s0.wateredOn, "today");
  assert.equal(plantState("2026-11-07", "2026-11-06").wateredOn, "Friday");
  assert.equal(plantState("2026-11-08", "2026-11-06"), null);
  assert.equal(plantState("2026-11-12", "2026-11-06").state, "upcoming");
  assert.equal(plantState("2026-11-13", "2026-11-06").state, "due");
});

test("before the first press: due on firstDue, else today", () => {
  assert.equal(plantState("2026-11-02", null).state, "due");
  assert.equal(plantState("2026-11-02", null, "2026-11-05"), null);
  assert.equal(plantState("2026-11-04", null, "2026-11-05").state, "upcoming");
});

test("phase windows", () => {
  assert.deepEqual(phase({ date: "2026-11-02", hhmm: "03:59" }), { mode: "ambient", day: "2026-11-01" });
  assert.deepEqual(phase({ date: "2026-11-02", hhmm: "04:00" }), { mode: "morning", day: "2026-11-02" });
  assert.deepEqual(phase({ date: "2026-11-02", hhmm: "10:59" }), { mode: "morning", day: "2026-11-02" });
  assert.deepEqual(phase({ date: "2026-11-02", hhmm: "11:00" }), { mode: "ambient", day: "2026-11-02" });
});

test("instant() round-trips across DST", () => {
  for (const [d, t] of [["2026-11-01", "06:30"], ["2026-03-08", "04:00"], ["2026-07-01", "23:15"]]) {
    assert.deepEqual(local(instant(d, t)), { date: d, hhmm: t });
  }
});
