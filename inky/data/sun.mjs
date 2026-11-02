// Sunrise / sunset computed locally (no API).
import { getTimes } from "suncalc";
import { instant, local, addDays, mins } from "../time.mjs";

export function sunTimes(day, lat = Number(process.env.HOME_LAT), lng = Number(process.env.HOME_LNG)) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const at = (d) => getTimes(instant(d, "12:00"), lat, lng);
  const t = at(day), y = at(addDays(day, -1));
  const sunrise = local(t.sunrise).hhmm, sunset = local(t.sunset).hhmm;
  const len = mins(sunset) - mins(sunrise);
  const lenY = mins(local(y.sunset).hhmm) - mins(local(y.sunrise).hhmm);
  const d = len - lenY;
  return { sunrise, sunset, minutes: len, delta: d === 0 ? "same as yesterday" : `${Math.abs(d)} min ${d < 0 ? "shorter" : "longer"}` };
}
