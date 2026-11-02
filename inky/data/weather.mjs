// Today's weather from OpenWeatherMap (free tier: current + 3-hour forecast),
// interpolated to the hourly shape the components draw (6am..10pm, °F).

import { instant, local } from "../time.mjs";

const BASE = "https://api.openweathermap.org/data/2.5";
const CONDITION = { Clouds: "Cloudy", Clear: "Clear", Rain: "Rain", Drizzle: "Drizzle", Snow: "Snow", Thunderstorm: "Storms", Mist: "Mist", Fog: "Fog", Haze: "Haze" };

export const FIRST_HOUR = 6, LAST_HOUR = 22;

const lerp = (a, b, t) => a + (b - a) * t;
const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
const span = (a, b) => {
  const end = b + 1, A = hourLabel(a), B = hourLabel(end % 24);
  return `${(a < 12) === (end < 12) ? A.replace(/am|pm/, "") : A} to ${B}`;
};

/** Pure: OWM current + forecast JSON -> component-ready weather. */
export function shapeWeather(current, forecast, day) {
  const pts = [{ t: current.dt * 1000, temp: current.main.temp, pop: /rain|drizzle|snow|thunder/i.test(current.weather?.[0]?.main || "") ? 0.9 : 0, kind: current.weather?.[0]?.main }]
    .concat((forecast.list || []).map((f) => ({ t: f.dt * 1000, temp: f.main.temp, pop: f.pop ?? 0, kind: f.weather?.[0]?.main })))
    .sort((a, b) => a.t - b.t);

  const at = (ms) => {
    if (ms <= pts[0].t) return { temp: pts[0].temp, pop: pts[0].pop, kind: pts[0].kind };
    for (let i = 1; i < pts.length; i++) {
      if (ms <= pts[i].t) {
        const A = pts[i - 1], B = pts[i], k = (ms - A.t) / (B.t - A.t);
        // pop belongs to the 3h block a forecast point starts; carry the nearer one
        const near = k < 0.5 ? A : B;
        return { temp: lerp(A.temp, B.temp, k), pop: near.pop, kind: near.kind };
      }
    }
    const L = pts[pts.length - 1];
    return { temp: L.temp, pop: L.pop, kind: L.kind };
  };

  const hours = [];
  for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) {
    const v = at(instant(day, `${String(h).padStart(2, "0")}:00`).getTime());
    hours.push({ h, t: Math.round(v.temp), p: Math.round(v.pop * 10) / 10, kind: v.kind });
  }
  const temps = hours.map((x) => x.t).concat(Math.round(current.main.temp));
  const hi = Math.max(...temps), lo = Math.min(...temps);

  // precipitation windows: runs of hours with p >= 0.5
  const windows = [];
  for (const x of hours) {
    const wet = x.p >= 0.5;
    const last = windows[windows.length - 1];
    if (wet && last && last.to === x.h - 1) last.to = x.h;
    else if (wet) windows.push({ from: x.h, to: x.h, kind: /snow/i.test(x.kind || "") ? "Snow" : "Rain" });
  }
  let summary;
  if (windows.length) summary = windows.slice(0, 2).map((w) => `${w.kind} ${span(w.from, w.to)}`).join(", ");
  else {
    const maybe = hours.reduce((a, b) => (b.p > a.p ? b : a), hours[0]);
    summary = maybe.p >= 0.3 ? `Chance of rain around ${hourLabel(maybe.h)}` : "Dry all day";
  }
  const main = current.weather?.[0]?.main || "";
  return {
    now: Math.round(current.main.temp),
    condition: CONDITION[main] || main || "—",
    summary,
    hi, lo,
    hours: hours.map(({ h, t, p }) => ({ h, t, p })),
    precip: windows,
    observedAt: local(new Date(current.dt * 1000)).hhmm,
  };
}

export async function fetchWeather(day) {
  const key = process.env.OPENWEATHERMAP_APIKEY;
  const lat = process.env.HOME_LAT, lon = process.env.HOME_LNG;
  if (!key || !lat || !lon) return null;
  const q = `lat=${lat}&lon=${lon}&appid=${key}&units=imperial&lang=en`;
  const [c, f] = await Promise.all([
    fetch(`${BASE}/weather?${q}`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json()),
    fetch(`${BASE}/forecast?${q}&cnt=16`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json()),
  ]);
  if (!c?.main || !f?.list) throw new Error(`OpenWeatherMap: ${c?.message || f?.message || "bad response"}`);
  return shapeWeather(c, f, day);
}
