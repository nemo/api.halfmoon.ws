// The pipeline: moment -> (cached) skeleton -> fresh facts -> fitted PNG.

import { local, phase, mins } from "./time.mjs";
import { gatherDay } from "./day.mjs";
import { fill } from "./fill.mjs";
import { renderScreen, validate } from "./render.mjs";
import { composeMorning, composeAmbient } from "./compose.mjs";
import { skeletonFor, ambientFallback } from "./directions.mjs";
import { state } from "./state.mjs";

const REFRESH_MIN = Number(process.env.INKY_REFRESH_MINUTES || 30);
const KEEP = new Set(["header", "main", "scale", "poster", "band", "canvas"]); // never dropped to fit

/** Render, then drop overflowing modules (last stacked first) until it fits. */
async function fitAndRender(screen) {
  const dropped = [];
  let s = structuredClone(screen);
  for (let i = 0; i < 4; i++) {
    const out = await renderScreen(s);
    if (!out.overflow.length) return { ...out, screen: s, dropped };
    let changed = false;
    for (const o of out.overflow) {
      const area = o.split(" ")[0];
      const v = s.slots[area];
      if (Array.isArray(v) && v.length > 1) { dropped.push(`${area}:${v.pop().component}`); if (v.length === 1) s.slots[area] = v[0]; changed = true; }
      else if (!KEEP.has(area)) { dropped.push(`${area}:${[].concat(v)[0]?.component}`); delete s.slots[area]; changed = true; }
    }
    if (!changed) return { ...out, screen: s, dropped };
  }
  const out = await renderScreen(s);
  return { ...out, screen: s, dropped };
}

async function skeletonForMoment(mode, day, data, { force, direction, persist }) {
  if (!force) {
    const cached = await state.getScreen(mode, day);
    if (cached) return cached;
  }
  const [feedback, history] = await Promise.all([state.feedbackSummary(), state.listHistory()]);
  const res = mode === "morning"
    ? await composeMorning(data, { feedback, history, direction })
    : await composeAmbient(day, { feedback, history });
  const entry = { ...res.skeleton, source: res.source, error: res.error, composedAt: new Date().toISOString() };
  if (persist) {
    await state.setScreen(mode, day, entry);
    await state.addHistory(day, mode, entry.direction, res.source);
  }
  return entry;
}

/**
 * @param {object} o
 * @param {{date,hhmm}} [o.at]      local moment (default: now)
 * @param {boolean} [o.preview]     don't persist anything, don't claim notes
 * @param {boolean} [o.fake]        synthetic data
 * @param {string}  [o.direction]   force a direction (model hint, or fallback skeleton)
 * @param {boolean} [o.compose]     force a fresh composition
 * @param {boolean} [o.fallback]    skip the model entirely
 */
export async function frame(o = {}) {
  const at = o.at || local();
  const { mode, day } = phase(at);
  const persist = !o.preview;

  // frame cache: one render per refresh bucket (morning) or per day (ambient)
  const bucket = mode === "morning" ? Math.floor(mins(at.hhmm) / REFRESH_MIN) : 0;
  const version = await state.version();
  const cacheKey = `${mode}:${day}:${bucket}:v${version}`;
  if (persist && !o.compose) {
    const hit = await state.getFrame(cacheKey);
    if (hit) return { ...hit, png: Buffer.from(hit.png, "base64"), cached: true };
  }

  const data = mode === "morning"
    ? await gatherDay(at, { fake: o.fake, claimNotes: persist, peekNotes: !persist })
    : { at, day, notes: [] };

  let skeleton;
  if (o.fallback) skeleton = mode === "morning" ? skeletonFor(o.direction || "weather-field", data) : ambientFallback(day);
  else skeleton = await skeletonForMoment(mode, day, data, { force: o.compose || !!o.direction, direction: o.direction, persist });

  let { screen, dropped, issues } = fill(skeleton, data);
  let errors = validate(screen);
  if (errors.length) {
    issues.push(...errors);
    skeleton = mode === "morning" ? skeletonFor("weather-field", data) : ambientFallback(day);
    ({ screen, dropped } = fill(skeleton, data));
  }
  const out = await fitAndRender(screen);
  const result = {
    hash: out.hash, mode, day, at,
    direction: skeleton.direction, source: skeleton.source || (o.fallback ? "fallback" : undefined),
    rationale: skeleton.rationale, composeError: skeleton.error,
    dropped: [...dropped, ...out.dropped], issues, dataErrors: data.errors || [],
    screen: out.screen,
  };
  if (persist) await state.setFrame(cacheKey, { ...result, png: out.png.toString("base64") });
  return { ...result, png: out.png, raw: out.raw };
}
