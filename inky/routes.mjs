// HTTP surface for the device, agents and development.
//
//   GET  /inky/frame.png          device   current frame; ETag = frame hash (304 when unchanged)
//   GET  /inky/frame.json         device   what the current frame is and why
//   POST /inky/button/:id         device   A watered · B thumbs up · C thumbs down · D no-op
//   POST /inky/notes              notes    { text, from } -> shown next morning
//   GET  /inky/notes              notes    list queued and recent notes
//   GET  /inky/preview            device   ?date=YYYY-MM-DD&time=HH:MM&direction=&fake=1&compose=1&fallback=1&format=png|json|html
//   GET  /inky/health             public   config check (no secrets)

import express from "express";
import { frame } from "./screen.mjs";
import { toHtml } from "./render.mjs";
import { state, store } from "./state.mjs";
import { local, phase } from "./time.mjs";
import { plantState } from "./plants.mjs";

const bearer = (req) => (req.get("authorization") || "").replace(/^Bearer\s+/i, "") || req.query.token || "";

/** Accept any of the given env tokens. Unset tokens are open locally, closed on Vercel. */
function auth(...envNames) {
  return (req, res, next) => {
    const tokens = envNames.map((n) => process.env[n]).filter(Boolean);
    if (!tokens.length) {
      if (process.env.VERCEL) return res.status(503).json({ error: `${envNames.join("/")} not configured` });
      return next();
    }
    if (tokens.includes(bearer(req))) return next();
    res.status(401).json({ error: "unauthorized" });
  };
}
const device = auth("INKY_DEVICE_TOKEN");
const notes = auth("INKY_NOTES_TOKEN", "INKY_DEVICE_TOKEN");

const meta = (f) => ({
  hash: f.hash, mode: f.mode, day: f.day, at: f.at, direction: f.direction, source: f.source,
  rationale: f.rationale, composeError: f.composeError, dropped: f.dropped, issues: f.issues,
  dataErrors: f.dataErrors, cached: !!f.cached,
});

function sendPng(req, res, f) {
  const etag = `"${f.hash}"`;
  res.set({ ETag: etag, "X-Inky-Hash": f.hash, "X-Inky-Mode": f.mode, "X-Inky-Direction": f.direction || "", "Cache-Control": "no-store" });
  if (req.get("if-none-match") === etag) return res.status(304).end();
  res.type("png").send(f.png);
}

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error("[inky]", e);
  res.status(500).json({ error: e.message });
});

export default function inky(app) {
  const r = express.Router();
  r.use(express.json({ limit: "64kb" }));

  r.get("/health", wrap(async (req, res) => {
    const at = local();
    res.json({
      ok: true, now: at, phase: phase(at), store: store.kind,
      configured: Object.fromEntries(["ANTHROPIC_API_KEY", "OPENWEATHERMAP_APIKEY", "ICAL_URLS", "GOOGLE_MAPS_API_KEY", "HOME_ADDRESS", "HOME_LAT", "HOME_LNG", "INKY_DEVICE_TOKEN", "INKY_NOTES_TOKEN"].map((k) => [k, !!process.env[k]])),
    });
  }));

  r.get("/frame.png", device, wrap(async (req, res) => sendPng(req, res, await frame())));
  r.get("/frame.json", device, wrap(async (req, res) => res.json(meta(await frame()))));

  r.post("/button/:id", device, wrap(async (req, res) => {
    const id = String(req.params.id).toUpperCase();
    const at = local();
    const { mode, day } = phase(at);
    if (id === "A") {
      await state.setLastWatered(at.date);
      await state.bump();
      return res.json({ ok: true, action: "watered", on: at.date, plants: plantState(at.date, at.date) });
    }
    if (id === "B" || id === "C") {
      const screen = await state.getScreen(mode, day);
      const vote = id === "B" ? 1 : -1;
      await state.addFeedback({ day, mode, direction: screen?.direction || "unknown", vote });
      return res.json({ ok: true, action: vote > 0 ? "liked" : "disliked", direction: screen?.direction || "unknown" });
    }
    if (id === "D") return res.json({ ok: true, action: "none" });
    res.status(400).json({ error: "button must be A, B, C or D" });
  }));

  r.post("/notes", notes, wrap(async (req, res) => {
    const text = String(req.body?.text || "").trim().replace(/\s+/g, " ");
    const from = String(req.body?.from || "").trim().slice(0, 40) || "Someone";
    if (!text) return res.status(400).json({ error: "text required" });
    if (text.length > 160) return res.status(400).json({ error: "text must be 160 characters or fewer" });
    const note = await state.addNote({ text, from });
    res.status(201).json({ ok: true, note, showsOn: "next morning, 4–11am" });
  }));
  r.get("/notes", notes, wrap(async (req, res) => res.json({ notes: (await state.listNotes()).slice(-20) })));

  r.get("/preview", device, wrap(async (req, res) => {
    const now = local();
    const at = { date: req.query.date || now.date, hhmm: req.query.time || now.hhmm };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(at.date) || !/^\d{2}:\d{2}$/.test(at.hhmm)) return res.status(400).json({ error: "date=YYYY-MM-DD time=HH:MM" });
    const f = await frame({
      at, preview: true,
      fake: req.query.fake === "1",
      direction: req.query.direction || undefined,
      compose: req.query.compose === "1",
      fallback: req.query.fallback === "1",
    });
    const fmt = req.query.format || "png";
    if (fmt === "json") return res.json({ ...meta(f), screen: f.screen });
    if (fmt === "html") return res.type("html").send(toHtml(f.screen));
    if (fmt === "raw") return res.type("png").send(f.raw);
    sendPng(req, res, f);
  }));

  app.use("/inky", r);
}
