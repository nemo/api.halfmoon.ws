// The five design directions, as deterministic skeletons. They are the
// fallback when the model is unavailable, the examples the model sees, and
// what /inky/preview?direction= renders without a model call.

export const DIRECTIONS = {
  "weather-field": "Weather as abstraction: the day's temperature as a perforated plate, rain falling as blue rules. A rail of the few things that need doing.",
  instrument: "Instrument panel: the day as a Braun radio tuning scale, meetings as stations, a needle at now. Small dials below.",
  poster: "Swiss poster: the single dominant fact of the day set huge (\"Rain from three.\", \"Offsite.\", \"Water day.\"), three quiet modules beneath.",
  timeline: "Aicher-style timeline strip: weather and daylight up top, the day as a measured band across the middle, details below.",
  quiet: "Quiet day: nearly empty. One word and one dot on a canvas, a single footer line. For days with little on.",
};

const header = { component: "dateline" };

/** Rail modules in priority order, given what's true today. */
function railFor(d, max = 3) {
  const out = [];
  const p = d.plants?.state;
  if (p && p !== "done" && p !== "upcoming") out.push({ component: "plants" });
  if (d.notes?.length) out.push({ component: "note" });
  if (d.travel) out.push({ component: "travel" });
  if (d.next) out.push({ component: "nextEvent" });
  if (p === "upcoming" || p === "done") out.push({ component: "plants" });
  if (out.length < max && d.sun) out.push({ component: "daylight" });
  return out.slice(0, max);
}

function posterLine(d) {
  const w = d.weather;
  if (d.plants && ["due", "overdue"].includes(d.plants.state)) return { text: "Water day.", sub: "The plants are waiting." };
  if (w?.precip?.length) {
    const r = w.precip[0];
    const h = r.from; const lbl = h === 12 ? "noon" : h < 12 ? `${h}` : `${h - 12}`;
    const word = r.kind === "Snow" ? "Snow" : "Rain";
    return h <= 7 ? { text: `${word} all morning.`, sub: w.summary } : { text: `${word} from ${["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"][h % 12] || lbl}.`, sub: w.summary };
  }
  if (w) return { text: `${w.now}°`, sub: `${w.condition}. ${w.summary}.` };
  return { text: new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }) + "." };
}

export function skeletonFor(direction, d) {
  const busy = (d.calendar?.events?.length || 0) > 0;
  switch (direction) {
    case "instrument":
      if (!busy) break;
      return { direction, template: "dial", slots: {
        header, scale: { component: "calendar", variant: "dial" },
        a: { component: "weather", variant: "compact" }, b: { component: "daylight" },
        c: railFor(d, 1)[0] || { component: "plants" },
      } };
    case "poster": {
      const mods = railFor(d, 3);
      return { direction, template: "poster", slots: {
        header, poster: { component: "poster", props: posterLine(d) },
        a: mods[0], b: mods[1], c: mods[2],
      } };
    }
    case "timeline":
      if (!busy) break;
      return { direction, template: "strip", slots: {
        header,
        tl: { component: "weather", variant: "compact" }, tr: { component: "daylight" },
        band: { component: "calendar", variant: "timeline" },
        bl: railFor(d, 4).find((m) => !["daylight", "plants"].includes(m.component)) || { component: "nextEvent" },
        br: { component: "plants" },
      } };
    case "quiet": {
      const word = d.weather ? (d.weather.precip?.length ? "Wet." : d.weather.hi >= 75 ? "Warm." : d.weather.hi <= 35 ? "Cold." : "Clear.") : "Morning.";
      const dot = d.weather?.precip?.length ? "blue" : "yellow";
      const bits = [d.weather && `${d.weather.now}°, ${d.weather.summary.toLowerCase()}`, d.next && `${d.next.title} at ${d.next.start}`].filter(Boolean);
      return { direction, template: "quiet", slots: {
        canvas: { component: "canvas", props: { gen: "quiet", word, dot } },
        footer: { component: "line", props: { text: bits.join(" · ") || d.day } },
      } };
    }
  }
  if (direction !== "weather-field" && !d.weather) return skeletonFor("quiet", d);
  if (!d.weather) return skeletonFor("quiet", d);
  return { direction: "weather-field", template: "rail", slots: {
    header, main: { component: "weather", variant: "field" }, rail: railFor(d, 3),
  } };
}

/* Ambient fallbacks: the generators in the design library, seeded by date. */
export function ambientFallback(day) {
  const gens = ["grille", "sunpath"];
  const n = [...day].reduce((a, c) => a + c.charCodeAt(0), 0);
  return { direction: `ambient-${gens[n % gens.length]}`, template: "full", slots: { canvas: { component: "canvas", props: { gen: gens[n % gens.length], seed: day } } } };
}
