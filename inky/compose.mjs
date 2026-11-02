// Sonnet composes the morning: direction, template, which components go
// where, variants, and the copy (poster line, canvas SVG). Facts are filled in
// afterwards by fill.mjs, so the model never invents a number or a time.

import { TEMPLATES } from "./design/src/templates.mjs";
import { REGISTRY } from "./design/src/components.mjs";
import { DIRECTIONS, skeletonFor, ambientFallback } from "./directions.mjs";
import { CANVAS_COLOURS } from "./sanitize.mjs";

export const MODEL = process.env.INKY_MODEL || "claude-sonnet-5-5";

const MORNING_TEMPLATES = Object.entries(TEMPLATES).filter(([k, t]) => !t.internal && k !== "full").map(([k]) => k);
const COMPONENTS = Object.keys(REGISTRY);

const CATALOGUE = {
  dateline: "Header line: weekday, date, place, last-updated time. DATA. Always the `header` area when a template has one.",
  weather: "DATA. Variants: compact (number + one line + small dot grille; fits 176px modules), full (big number + hourly grille), field (the whole hourly day as a perforated plate, rain as blue rules; needs a big area like rail.main).",
  nextEvent: "DATA. The next event: big time or 'in N min', title, where. Fits small modules.",
  calendar: "DATA. Variants: list (next few events; props.max), timeline (the day as a band; wide areas like strip.band), dial (Braun tuning scale; dial.scale). Optional props: from/to hours.",
  daylight: "DATA. Sun arc with sunrise/sunset and day length.",
  travel: "DATA. When to leave for the first in-person event, minutes, train line. Only when travel data exists.",
  plants: "DATA. Weekly watering reminder; gets louder as it becomes due/overdue. Only when plants state is not null. When due or overdue it is the most important thing on the screen.",
  note: "DATA. A note left by the owner or one of their agents. props.index picks which note (0 = first). Needs height: avoid 96px modules for notes longer than ~30 chars.",
  poster: "COPY. props.text: the day's dominant fact as a short statement (<= 18 chars sets giant, otherwise hero; 2-4 words is best, end with a full stop). props.sub: one supporting sentence. props.ink: ink|blue. Only true facts from the data.",
  line: "COPY. props.text: one quiet sentence for a footer.",
  canvas: `COPY. The free slot. Either props.gen ("grille" | "sunpath" | "quiet" with props.word + props.dot) or props.svg: your own SVG artwork sized exactly to the area. SVG rules: only svg, g, rect, circle, ellipse, line, polyline, polygon, path, text, tspan; colours only ${Object.keys(CANVAS_COLOURS).join(", ")} (or their hex); no gradients, opacity, filters, images, styles or scripts; strokes >= 2px and text >= 18px (it is a 600x448 e-ink panel read from 1.5m).`,
};

const SYSTEM = `You compose one screen a day for a 600x448, 7-ink e-ink panel (Inky Impression) in the owner's bathroom. It is read for a few seconds at a time, from about 1.5 m away, between 4 and 11am.

Design language: Braun / Dieter Rams, "less but better". A strict grid, one grotesk typeface, lots of white space. Monochrome first: colour is a small functional mark, never a field. Never orange. The owner wants a small "wow" every morning: vary the direction day to day, lean towards directions they have liked, away from ones they disliked, and don't repeat yesterday's unless the day really calls for it.

Your job is layout and voice, not facts. Components marked DATA are filled by the system with live data; you only choose where they go and which variant. Components marked COPY carry your words or artwork; every claim in them must be true according to the day's data. Prefer saying less. Leave an area empty rather than filling it with something weak.

Priorities: an overdue/due plant reminder and anything time-critical (leave-by times, rain at a commute) beat everything else. Use the poster or a canvas when one fact dominates the day.

Calendar: the owner's calendar holds placeholder blocks that are not real events, such as "Travel", "No call day" or "No calls", focus/hold blocks, "Busy", OOO. Ignore them completely: never headline, mention or count them. The system already filters the common ones; if one slips through, treat it as absent. Real meetings matter: on a busy day, show the shape of the day (how many meetings, when the first one is, where the gaps are), not just the plants.`;

function catalogueText() {
  const t = MORNING_TEMPLATES.map((k) => {
    const T = TEMPLATES[k];
    return `- ${k}: ${T.note}\n  areas: ${Object.entries(T.areas).map(([a, b]) => `${a} ${b.w}x${b.h}`).join(", ")}`;
  }).join("\n");
  const c = Object.entries(CATALOGUE).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  const d = Object.entries(DIRECTIONS).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  return `TEMPLATES\n${t}\n\nCOMPONENTS\n${c}\n\nDIRECTIONS (you may also invent a new one; name it in kebab-case)\n${d}`;
}

function dayText(d, { feedback, history }) {
  const ev = (d.calendar?.events || []).map((e) => `  ${e.start}-${e.end} ${e.title}${e.where ? ` @ ${e.where}` : ""}${e.personal ? " (personal)" : " (work)"}`).join("\n") || "  none";
  const allDay = (d.calendar?.allDay || []).map((e) => `  ${e.title}`).join("\n");
  return `TODAY ${d.day} (${new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}), composed at ${d.at.hhmm}, ${d.place}.
WEATHER ${d.weather ? `${d.weather.now}°F now, ${d.weather.condition}, ${d.weather.summary}, high ${d.weather.hi}° low ${d.weather.lo}°. Hourly (h:temp:rain-chance): ${d.weather.hours.map((h) => `${h.h}:${h.t}:${h.p}`).join(" ")}` : "unavailable"}
SUN ${d.sun ? `${d.sun.sunrise}-${d.sun.sunset}, ${d.sun.delta}` : "unavailable"}
EVENTS\n${ev}${allDay ? `\nALL-DAY\n${allDay}` : ""}
NEXT ${d.next ? `${d.next.title} at ${d.next.start} (in ${d.next.inMinutes} min)` : "nothing"}
TRAVEL ${d.travel ? `leave by ${d.travel.leaveBy} for ${d.travel.to} (${d.travel.minutes} min${d.travel.line ? `, ${d.travel.line} train` : ""})` : "none"}
PLANTS ${d.plants ? JSON.stringify(d.plants) : "null (don't show)"}
NOTES ${d.notes?.length ? d.notes.map((n, i) => `[${i}] "${n.text}" from ${n.from}`).join("; ") : "none"}

FEEDBACK SO FAR (direction: thumbs up/down) ${JSON.stringify(feedback)}
RECENT DIRECTIONS ${history.filter((h) => h.mode === "morning").slice(-7).map((h) => `${h.day}:${h.direction}`).join(", ") || "none yet"}`;
}

const nullable = (s) => ({ anyOf: [s, { type: "null" }] });
const PROPS = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: nullable({ type: "string" }), sub: nullable({ type: "string" }), ink: nullable({ type: "string", enum: ["ink", "blue"] }),
    svg: nullable({ type: "string" }), gen: nullable({ type: "string", enum: ["grille", "sunpath", "quiet"] }), seed: nullable({ type: "string" }),
    word: nullable({ type: "string" }), dot: nullable({ type: "string", enum: ["yellow", "blue", "green", "red"] }),
    index: nullable({ type: "integer" }), from: nullable({ type: "integer" }), to: nullable({ type: "integer" }), max: nullable({ type: "integer" }),
  },
  required: ["text", "sub", "ink", "svg", "gen", "seed", "word", "dot", "index", "from", "to", "max"],
};
export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    direction: { type: "string", description: "kebab-case name of the design direction" },
    rationale: { type: "string", description: "one sentence: why this layout for today" },
    template: { type: "string", enum: MORNING_TEMPLATES },
    slots: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          area: { type: "string" },
          blocks: { type: "array", items: {
            type: "object", additionalProperties: false,
            properties: {
              component: { type: "string", enum: COMPONENTS },
              variant: nullable({ type: "string", enum: ["compact", "full", "field", "list", "timeline", "dial"] }),
              props: PROPS,
            },
            required: ["component", "variant", "props"],
          } },
        },
        required: ["area", "blocks"],
      },
    },
  },
  required: ["direction", "rationale", "template", "slots"],
};

const strip = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== null && v !== undefined));

/** Model output -> skeleton, or throws with reasons. */
export function toSkeleton(out) {
  const T = TEMPLATES[out.template];
  if (!T || T.internal || out.template === "full") throw new Error(`bad template ${out.template}`);
  const errors = [];
  const slots = {};
  for (const s of out.slots || []) {
    if (!T.areas[s.area]) { errors.push(`no area ${s.area}`); continue; }
    const blocks = (s.blocks || []).filter((b) => REGISTRY[b.component]).map((b) => ({
      component: b.component, ...(b.variant ? { variant: b.variant } : {}), props: strip(b.props),
    }));
    if (blocks.length) slots[s.area] = blocks.length === 1 ? blocks[0] : blocks;
  }
  if (T.areas.header && !slots.header) slots.header = { component: "dateline" };
  if (!Object.keys(slots).length) errors.push("empty screen");
  if (errors.length > 2) throw new Error(errors.join("; "));
  return { direction: out.direction, rationale: out.rationale, template: out.template, slots };
}

const usesComponent = (sk, name) => JSON.stringify(sk.slots).includes(`"component":"${name}"`);
/** Things a morning must not leave out, as correction sentences for the model. */
export function missingEssentials(sk, d) {
  const out = [];
  const meetings = (d.calendar?.events || []).length;
  if (meetings >= 2 && !usesComponent(sk, "calendar"))
    out.push(`There are ${meetings} meetings today; the screen must include the calendar component (list, timeline or dial) so the shape of the day is visible.`);
  return out;
}

let client;
async function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    client = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  }
  return client;
}

/**
 * @returns {Promise<{skeleton, source: "model"|"fallback", error?: string}>}
 */
export async function composeMorning(d, { feedback = {}, history = [], direction } = {}) {
  const c = await anthropic();
  const fallback = (error) => ({ skeleton: skeletonFor(direction || "weather-field", d), source: "fallback", error });
  if (!c) return fallback("ANTHROPIC_API_KEY unset");
  try {
    const { jsonSchemaOutputFormat } = await import("@anthropic-ai/sdk/helpers/json-schema");
    const ask = direction ? `\n\nUse the "${direction}" direction today.` : "";
    const messages = [{ role: "user", content: `${catalogueText()}\n\n${dayText(d, { feedback, history })}${ask}\n\nCompose this morning's screen.` }];
    let skeleton;
    for (let attempt = 0; attempt < 2; attempt++) {
      const msg = await c.messages.parse({ model: MODEL, max_tokens: 8000, system: SYSTEM, messages, output_config: { format: jsonSchemaOutputFormat(SCHEMA) } });
      if (!msg.parsed_output) throw new Error(`no parsed output (stop: ${msg.stop_reason})`);
      skeleton = toSkeleton(msg.parsed_output);
      const missing = missingEssentials(skeleton, d);
      if (!missing.length) break;
      messages.push({ role: "assistant", content: JSON.stringify(msg.parsed_output) }, { role: "user", content: `Revise: ${missing.join(" ")} Keep the direction if it still works.` });
    }
    return { skeleton, source: "model" };
  } catch (e) {
    return fallback(`model: ${e.message}`);
  }
}

const AMBIENT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { title: { type: "string" }, svg: { type: "string" } },
  required: ["title", "svg"],
};

export async function composeAmbient(day, { feedback = {}, history = [] } = {}) {
  const c = process.env.INKY_AMBIENT_MODEL === "0" ? null : await anthropic();
  if (!c) return { skeleton: ambientFallback(day), source: "fallback", error: "model off" };
  try {
    const { jsonSchemaOutputFormat } = await import("@anthropic-ai/sdk/helpers/json-schema");
    const recent = history.filter((h) => h.mode === "ambient").slice(-5).map((h) => h.direction).join(", ");
    const msg = await c.messages.parse({
      model: MODEL,
      max_tokens: 12000,
      system: SYSTEM,
      messages: [{ role: "user", content: `It is ${day}, after 11am. The panel switches to an ambient, data-free piece that stays up until 4am: calm, beautiful, in the Braun / Rams / Swiss-modernist vein (think speaker grilles, dials, Aicher pictograms, Max Bill, Josef Müller-Brockmann). No text other than at most one small word. Mostly ink on paper; at most two small accents from: red, blue, yellow, green. Never orange.

Return SVG for the full panel, exactly 600x448. ${CATALOGUE.canvas.replace(/^COPY\. The free slot\. Either .*?props\.svg: /, "")}
Recent ambient titles (don't repeat): ${recent || "none"}. Feedback by direction: ${JSON.stringify(feedback)}.` }],
      output_config: { format: jsonSchemaOutputFormat(AMBIENT_SCHEMA) },
    });
    const out = msg.parsed_output;
    if (!out?.svg) throw new Error("no svg");
    return {
      skeleton: { direction: `ambient-${String(out.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`, template: "full", slots: { canvas: { component: "canvas", props: { svg: out.svg } } } },
      source: "model",
    };
  } catch (e) {
    return { skeleton: ambientFallback(day), source: "fallback", error: `model: ${e.message}` };
  }
}
