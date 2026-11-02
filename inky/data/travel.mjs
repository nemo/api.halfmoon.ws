// Transit time from home to the first in-person event (Google Routes API).
// Skipped when GOOGLE_MAPS_API_KEY or HOME_ADDRESS is unset.
import { local, mins } from "../time.mjs";
import { store } from "../state.mjs";

const pad = (n) => String(n).padStart(2, "0");
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export async function travelTo(event, { now } = {}) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const home = process.env.HOME_ADDRESS;
  if (!key || !home || !event?.where) return null;

  const cacheKey = `travel:${event.startsAt}:${event.where}`;
  const cached = await store.get(cacheKey);
  let route = cached;
  if (!route) {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.duration,routes.legs.steps.travelMode,routes.legs.steps.transitDetails.transitLine.nameShort,routes.legs.steps.transitDetails.transitLine.vehicle.type",
      },
      body: JSON.stringify({
        origin: { address: home },
        destination: { address: event.where },
        travelMode: "TRANSIT",
        arrivalTime: event.startsAt,
      }),
    });
    const json = await res.json();
    const r = json.routes?.[0];
    if (!r) return null;
    const steps = (r.legs || []).flatMap((l) => l.steps || []);
    const transit = steps.filter((s) => s.travelMode === "TRANSIT");
    route = {
      minutes: Math.ceil(parseInt(r.duration, 10) / 60),
      line: transit[0]?.transitDetails?.transitLine?.nameShort || null,
      mode: transit.length ? (transit[0].transitDetails?.transitLine?.vehicle?.type === "BUS" ? "bus" : "subway") : "walk",
    };
    await store.set(cacheKey, route, 30 * 60);
  }
  if (!route.minutes || route.minutes < 3) return null; // effectively at home
  const leave = Math.max(0, mins(event.start) - route.minutes - 2); // two minutes of slack
  const nowM = now ? mins(now) : mins(local().hhmm);
  return {
    to: shortPlace(event.where),
    leaveBy: hhmm(leave),
    minutes: route.minutes,
    line: route.line && route.line.length <= 2 ? route.line : undefined,
    mode: route.mode,
    urgent: leave - nowM <= 30,
    forEvent: event.title,
  };
}

/** "Industry City, 220 36th St, Brooklyn, NY 11232, USA" -> "Industry City" */
export const shortPlace = (where) => where.split(",")[0].trim().slice(0, 28);
