// Synthetic day for local dev (INKY_FAKE=1 or ?fake=1). Not real data.
export function fakeDay(day) {
  const temps = [46, 46, 47, 49, 51, 53, 55, 56, 57, 56, 54, 52, 51, 50, 49, 48, 47];
  const rain = [0.9, 0.9, 0.8, 0.8, 0.7, 0.6, 0.4, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0];
  const hours = temps.map((t, i) => ({ h: 6 + i, t, p: rain[i] }));
  return {
    weather: { now: 47, condition: "Rain", summary: "Rain 6 to 11am", hi: 57, lo: 46, hours, precip: [{ from: 6, to: 11, kind: "Rain" }] },
    calendar: {
      ok: true,
      allDay: [],
      events: [
        { start: "09:30", end: "10:00", title: "Pearmill standup", where: "Zoom", personal: false, physical: false },
        { start: "11:00", end: "12:00", title: "Flux weekly", where: "Zoom", personal: false, physical: false },
        { start: "13:00", end: "14:00", title: "Lunch with Sam", where: "Walter's, Fort Greene", personal: true, physical: true },
        { start: "15:00", end: "15:45", title: "Better pacing review", where: "Meet", personal: false, physical: false },
        { start: "19:30", end: "21:00", title: "Dinner at Olea", where: "Olea, Lafayette Ave", personal: true, physical: true },
      ].map((e) => ({ ...e, startsAt: `${day}T${e.start}:00` })),
    },
    travel: { to: "Walter's", leaveBy: "12:44", minutes: 14, mode: "walk", urgent: false, forEvent: "Lunch with Sam" },
    sun: { sunrise: "06:31", sunset: "16:46", minutes: 615, delta: "2 min shorter" },
  };
}
