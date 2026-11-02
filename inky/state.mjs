// Durable state. Upstash Redis on Vercel (KV_REST_API_URL / KV_REST_API_TOKEN,
// as set by the Upstash integration); a JSON file locally so dev survives restarts.
//
// Keys
//   inky:plants:lastWatered   "YYYY-MM-DD"
//   inky:notes                [{ id, text, from, at, shownOn? }]
//   inky:feedback             [{ day, direction, vote: 1|-1, at }]
//   inky:screen:<mode>:<day>  composed screen JSON (cached for that day)
//   inky:frame:current        { hash, at }  last frame served (debug)

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PREFIX = "inky:";

function redisStore() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  let client;
  const get = async () => {
    if (!client) { const { Redis } = await import("@upstash/redis"); client = new Redis({ url, token }); }
    return client;
  };
  return {
    kind: "upstash",
    async get(k) { return (await (await get()).get(PREFIX + k)) ?? null; },
    async set(k, v, ttlSeconds) {
      const c = await get();
      return ttlSeconds ? c.set(PREFIX + k, v, { ex: ttlSeconds }) : c.set(PREFIX + k, v);
    },
  };
}

function fileStore() {
  const file = process.env.INKY_STATE_FILE ||
    (process.env.VERCEL ? path.join(os.tmpdir(), "inky-state.json") : path.join(process.cwd(), ".inky-state.json"));
  let mem = null;
  const load = () => {
    if (mem) return mem;
    try { mem = JSON.parse(fs.readFileSync(file, "utf8")); } catch { mem = {}; }
    return mem;
  };
  const save = () => { try { fs.writeFileSync(file, JSON.stringify(mem, null, 2)); } catch { /* read-only fs: memory only */ } };
  return {
    kind: "file",
    file,
    async get(k) {
      const e = load()[k];
      if (!e) return null;
      if (e.exp && e.exp < Date.now()) { delete mem[k]; save(); return null; }
      return e.v;
    },
    async set(k, v, ttlSeconds) { load()[k] = { v, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null }; save(); },
  };
}

export const store = redisStore() || fileStore();

const MAX_NOTES = 50, MAX_FEEDBACK = 500;
const DAY = 24 * 3600;

export const state = {
  /* plants */
  getLastWatered: () => store.get("plants:lastWatered"),
  setLastWatered: (date) => store.set("plants:lastWatered", date),

  /* notes */
  async listNotes() { return (await store.get("notes")) || []; },
  async addNote({ text, from }) {
    const notes = await this.listNotes();
    const note = { id: Math.random().toString(36).slice(2, 10), text, from, at: new Date().toISOString() };
    notes.push(note);
    await store.set("notes", notes.slice(-MAX_NOTES));
    return note;
  },
  /** Claim every unshown note for `day`; return the notes shown on `day`. */
  async claimNotes(day) {
    const notes = await this.listNotes();
    let changed = false;
    for (const n of notes) if (!n.shownOn) { n.shownOn = day; changed = true; }
    if (changed) await store.set("notes", notes);
    return notes.filter((n) => n.shownOn === day);
  },
  async notesFor(day) { return (await this.listNotes()).filter((n) => n.shownOn === day); },

  /* design feedback */
  async listFeedback() { return (await store.get("feedback")) || []; },
  async addFeedback(entry) {
    const fb = await this.listFeedback();
    fb.push({ ...entry, at: new Date().toISOString() });
    await store.set("feedback", fb.slice(-MAX_FEEDBACK));
  },
  /** { [direction]: { up, down } } */
  async feedbackSummary() {
    const out = {};
    for (const f of await this.listFeedback()) {
      const s = (out[f.direction || "unknown"] ||= { up: 0, down: 0 });
      f.vote > 0 ? s.up++ : s.down++;
    }
    return out;
  },

  /* which direction ran on which day, for rotation */
  async listHistory() { return (await store.get("history")) || []; },
  async addHistory(day, mode, direction, source) {
    const h = (await this.listHistory()).filter((x) => !(x.day === day && x.mode === mode));
    h.push({ day, mode, direction, source });
    await store.set("history", h.slice(-60));
  },

  /* bumped on anything that should invalidate cached frames (button presses) */
  async version() { return (await store.get("version")) || 0; },
  async bump() { const v = (await this.version()) + 1; await store.set("version", v); return v; },

  /* rendered frames, cached per refresh bucket */
  getFrame: (key) => store.get(`frame:${key}`),
  setFrame: (key, frame) => store.set(`frame:${key}`, frame, DAY),

  /* composed screens, one per mode per day */
  getScreen: (mode, day) => store.get(`screen:${mode}:${day}`),
  setScreen: (mode, day, screen) => store.set(`screen:${mode}:${day}`, screen, 3 * DAY),
};
