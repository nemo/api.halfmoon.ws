// Component library. Every component is (props, box) => HTML string, where
// box = { w, h, variant } in device pixels. Props are plain JSON so a model can
// write them. Components never fetch anything and never read the clock.

import { INK, T, col, esc, mins, t12, time, hourLabel, dur, clamp, lerp, grille, rng } from "./lib.mjs";

const ap = (hhmm) => { const { t, ap } = t12(hhmm); return `${t}<span class="ap">${ap}</span>`; };

/* ------------------------------------------------------------------ */
/* dateline: the top line of every morning screen                      */
/* props: { date: "2026-11-02", place?: "Fort Greene", updated?: "06:30" } */
export function dateline({ date, place, updated }, box) {
  const d = new Date(`${date}T12:00:00`);
  const day = d.toLocaleDateString("en-US", { weekday: "long" });
  const rest = d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  const right = [place, updated && time(updated)].filter(Boolean).map(esc).join(" · ");
  return `<div class="c-dateline" style="width:${box.w}px">
    <div class="title"><b>${day}</b> <span class="muted">${rest}</span></div>
    <div class="small">${right}</div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* weather                                                             */
/* props: { now: 54, condition: "Cloudy", summary: "Rain 3–7pm",       */
/*          hi: 61, lo: 49, hours: [{ h: 6, t: 50, p: 0.1 }, ...] }   */
/* variants: compact | full | field                                    */
export function weather(p, box) {
  const v = box.variant || "compact";
  if (v === "field") return weatherField(p, box);
  const hours = p.hours || [];
  const narrow = box.w < 240;
  const pitch = clamp(Math.floor(box.w / Math.max(1, hours.length)), 8, v === "full" ? 16 : 12);
  const cols = Math.min(hours.length, Math.floor(box.w / pitch));
  const head = narrow ? 52 : 48;                     // reading line above the grille
  const rows = v === "full" ? 7 : clamp(Math.floor(((box.h || 124) - head - 20) / pitch), 3, 5);
  const span = Math.max(1, p.hi - p.lo);
  const level = (t) => Math.round(1 + ((t - p.lo) / span) * (rows - 1));
  const g = grille({
    cols, rows, pitch, r: Math.max(2.5, pitch * 0.3),
    fill: (c, r) => {
      const hr = hours[c];
      if (!hr || rows - r > level(hr.t)) return null;
      return hr.p >= 0.5 ? col("rain") : "ink";
    },
  });
  const labels = hours.slice(0, cols).map((hr, c) =>
    hr.h % 3 === 0 ? `<text x="${c * pitch + pitch / 2}" y="${rows * pitch + 16}" text-anchor="middle">${hourLabel(hr.h)}</text>` : ""
  ).join("");
  const gw = cols * pitch, gh = rows * pitch + 20;
  const shape = `<svg class="grille-svg" width="${gw}" height="${gh}" viewBox="0 0 ${gw} ${gh}">${g}<g class="svg-small">${labels}</g></svg>`;

  if (v === "full") {
    return `<div class="c-weather full">
      <div class="row gap2">
        <div class="hero">${p.now}°</div>
        <div class="stack">
          <div class="title">${esc(p.condition)}</div>
          <div class="body">${esc(p.summary || "")}</div>
          <div class="small hilo">${p.hi}° / ${p.lo}°</div>
        </div>
      </div>
      ${shape}
    </div>`;
  }
  return `<div class="c-weather compact ${narrow ? "narrow" : ""}">
    <div class="row gap1">
      <div class="display">${p.now}°</div>
      <div class="stack">
        <div class="${narrow ? "small" : "body"}"><b>${esc(p.summary || p.condition)}</b></div>
        <div class="small">${p.hi}° / ${p.lo}°</div>
      </div>
    </div>
    ${shape}
  </div>`;
}

/* Weather as abstraction: temperature as a dithered colour field, rain as rules. */
function weatherField(p, box) {
  // Temperature as dot size (a perforated plate: warmer hours, bigger holes),
  // rain as water dots falling from the top in proportion to its chance.
  // Pure dots on paper: no gradient, no dither, nothing to go blotchy.
  const hours = p.hours || [];
  const n = hours.length, w = box.w, h = box.h;
  const readH = 96, fieldY = readH + 12, fieldH = h - fieldY - 24;
  const pitch = 8;
  const perHour = w / n;
  const cols = Math.floor(w / pitch), rows = Math.floor(fieldH / pitch);
  const span = Math.max(1, p.hi - p.lo);
  let dots = "";
  for (let cI = 0; cI < cols; cI++) {
    const x = cI * pitch + pitch / 2;
    const hr = hours[Math.min(n - 1, Math.floor(x / perHour))];
    const k = (hr.t - p.lo) / span;                       // 0 cold .. 1 warm
    const r = 1 + k * 2.4;                                 // hole radius 1..3.4px
    const wet = Math.round(rows * hr.p * 0.85);            // rows of rain from the top
    for (let rI = 0; rI < rows; rI++) {
      const y = fieldY + rI * pitch + pitch / 2;
      if (rI < wet) dots += `<rect x="${Math.round(x) - 1}" y="${Math.round(y) - 2 + (cI % 2 ? 4 : 0)}" width="3" height="4" fill="${col("rain")}"/>`;
      else if (r < 1.6) dots += `<rect x="${Math.round(x) - 1}" y="${Math.round(y) - 1}" width="2" height="2" fill="${INK.ink}"/>`;
      else dots += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="${INK.ink}"/>`;
    }
  }
  const labels = hours.map((hr, i) => hr.h % 3 === 0
    ? `<text x="${Math.round(i * perHour + perHour / 2)}" y="${h - 4}" text-anchor="middle">${hourLabel(hr.h)}</text>` : "").join("");
  return `<div class="c-weather field" style="width:${w}px;height:${h}px">
    <div class="field-read row gap2">
      <div class="hero">${p.now}°</div>
      <div class="stack"><div class="title">${esc(p.condition)}</div><div class="small">${esc(p.summary || "")}</div><div class="small">${p.hi}° / ${p.lo}°</div></div>
    </div>
    <svg class="field-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${dots}<g class="svg-small">${labels}</g></svg>
  </div>`;
}

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(t, 0, 1))).toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------ */
/* nextEvent: the one thing coming up                                  */
/* props: { title, start: "09:30", inMinutes: 42, where?: "Zoom" }     */
export function nextEvent(p, box) {
  const lead = p.inMinutes < 60 ? `in ${p.inMinutes} min` : ap(p.start);
  return `<div class="c-next ${box.w < 240 ? "narrow" : ""}">
    <div class="display">${lead}</div>
    <div class="body"><b>${esc(p.title)}</b></div>
    <div class="small">${p.inMinutes < 60 ? time(p.start) : ""}${p.where ? (p.inMinutes < 60 ? " · " : "") + esc(p.where) : ""}</div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* calendar                                                            */
/* props: { events: [{ start, end, title, where?, personal? }],        */
/*          now?: "06:40", from?: 7, to?: 21, max?: 3 }                */
/* variants: list | timeline | dial                                    */
export function calendar(p, box) {
  const v = box.variant || "list";
  if (v === "timeline") return calTimeline(p, box);
  if (v === "dial") return calDial(p, box);
  const max = p.max ?? 3;
  const shown = p.events.slice(0, max);
  const rest = p.events.slice(max);
  const rows = shown.map((e) => `<div class="ev">
      <div class="ev-t">${ap(e.start)}</div>
      <div class="ev-b"><div class="body ev-title">${esc(e.title)}</div>${e.where && p.detail !== false ? `<div class="small">${esc(e.where)}</div>` : ""}</div>
    </div>`).join("");
  let more = "";
  if (rest.length) {
    const last = p.events[p.events.length - 1];
    more = `<div class="ev-more small">${rest.length} more, until ${time(last.end)}</div>${density(p, box.w)}`;
  }
  return `<div class="c-cal list">${rows}${more}</div>`;
}

/* one dot per half hour; solid where busy */
function density(p, w) {
  const from = (p.from ?? 7) * 60, to = (p.to ?? 19) * 60;
  const slots = (to - from) / 30;
  const pitch = Math.floor(w / slots);
  const busy = (s) => p.events.some((e) => mins(e.start) < from + (s + 1) * 30 && mins(e.end) > from + s * 30);
  const g = grille({ cols: slots, rows: 1, pitch, r: 3, fill: (c) => (busy(c) ? "ink" : null) });
  return `<svg width="${slots * pitch}" height="${pitch}" viewBox="0 0 ${slots * pitch} ${pitch}">${g}</svg>`;
}

/* Aicher-style strip: the day as a measured band, events as blocks, red needle at now. */
function calTimeline(p, box) {
  const from = (p.from ?? 7), to = (p.to ?? 21);
  const W = box.w, H = box.h;
  const x = (m) => Math.round(((m - from * 60) / ((to - from) * 60)) * (W - 1));
  const band = { y: 40, h: 22 };
  let s = "";
  for (let hr = from; hr <= to; hr++) {
    const X = x(hr * 60);
    const major = hr % 3 === 0;
    s += `<rect x="${X}" y="${band.y + band.h}" width="1" height="${major ? 10 : 5}" fill="${INK.ink}"/>`;
    if (major) s += `<text x="${X}" y="${band.y + band.h + 26}" text-anchor="${hr === from ? "start" : hr === to ? "end" : "middle"}">${hourLabel(hr)}</text>`;
  }
  s += `<rect x="0" y="${band.y + band.h}" width="${W}" height="1" fill="${INK.ink}"/>`;
  const labels = placeLabels(p.events.map((e) => ({ x: x(mins(e.start)), text: e.title })), 2, W, 14);
  p.events.forEach((e, i) => {
    const a = x(mins(e.start)), b = x(mins(e.end));
    s += evBar(a, band.y, Math.max(4, b - a - 2), band.h, e.personal);
    const L = labels[i];
    if (L.row >= 0) s += `<text class="lbl" x="${L.anchor === "end" ? a + Math.max(3, b - a - 2) : a}" y="${14 + L.row * 18}" text-anchor="${L.anchor}">${esc(e.title)}</text>`;
  });
  if (p.now) {
    const N = x(mins(p.now));
    s += `<rect x="${Math.max(0, N - 1)}" y="${band.y - 6}" width="3" height="${band.h + 16}" fill="${col("now")}"/>`;
  }
  return `<div class="c-cal timeline"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="svg-small">${s}</svg></div>`;
}

/* personal events solid, work events outlined (blue stays for water) */
const evBar = (x, y, w, h, personal) => personal
  ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${INK.ink}"/>`
  : `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="${INK.paper}" stroke="${INK.ink}" stroke-width="2"/>`;

/* Greedy label rows: each label goes in the first row where it clears its
   neighbour; labels that fit nowhere are dropped rather than overprinted. */
function placeLabels(items, rows, W, em) {
  const ends = Array(rows).fill(-Infinity);
  return items.map((it) => {
    const w = it.text.length * em * 0.58;
    const right = it.x + w > W;
    const ax = right ? (it.xEnd ?? it.x) : it.x;           // right-anchored labels hang off the bar's end
    const a = right ? ax - w - 6 : ax, b = right ? ax : ax + w + 6;
    for (let r = 0; r < rows; r++) if (a >= ends[r] + 10) { ends[r] = b; return { ...it, row: r, anchor: right ? "end" : "start" }; }
    // second chance: the short form (title only)
    if (it.short && it.short !== it.text) {
      const w2 = it.short.length * em * 0.58, r2 = it.x + w2 > W;
      const ax2 = r2 ? (it.xEnd ?? it.x) : it.x;
      const a2 = r2 ? ax2 - w2 - 6 : ax2, b2 = r2 ? ax2 : ax2 + w2 + 6;
      for (let r = 0; r < rows; r++) if (a2 >= ends[r] + 10) { ends[r] = b2; return { ...it, row: r, anchor: r2 ? "end" : "start", useShort: true }; }
    }
    return { ...it, row: -1 };
  });
}

/* Braun radio tuning scale: hours as frequencies, events as stations, red needle at now. */
function calDial(p, box) {
  const from = p.from ?? 6, to = p.to ?? 22;
  const W = box.w, H = box.h;
  const scaleY = H - 44;
  const pad = 10;
  const x = (m) => Math.round(((m - from * 60) / ((to - from) * 60)) * (W - 2 * pad)) + pad;
  let s = "";
  for (let m = from * 60; m <= to * 60; m += 15) {
    const X = x(m), hour = m % 60 === 0;
    s += `<rect x="${X}" y="${scaleY - (hour ? 16 : 7)}" width="${hour ? 2 : 1}" height="${hour ? 16 : 7}" fill="${INK.ink}"/>`;
    if (hour && (m / 60) % 2 === 0) s += `<text class="dial-num" x="${X + 1}" y="${scaleY + 28}" text-anchor="middle">${hourLabel(m / 60)}</text>`;
  }
  s += `<rect x="0" y="${scaleY}" width="${W}" height="2" fill="${INK.ink}"/>`;
  const items = p.events.map((e) => ({ x: x(mins(e.start)), xEnd: x(mins(e.end)), text: `${e.title} ${time(e.start)}`, short: e.title }));
  const placed = placeLabels(items, 4, W, 16);
  p.events.forEach((e, i) => {
    const a = x(mins(e.start)), b = x(mins(e.end));
    const L = placed[i];
    const barY = scaleY - 24;
    if (L.row >= 0) {
      const ly = 18 + L.row * 28;
      const lx = L.anchor === "end" ? b - 1 : a;
      s += `<rect x="${lx}" y="${ly + 6}" width="1" height="${barY - ly - 6}" fill="${INK.ink}"/>`;
      s += `<text class="dial-lbl" x="${L.anchor === "end" ? b - 2 : a + 6}" y="${ly + 4}" text-anchor="${L.anchor}">${esc(e.title)}${L.useShort ? "" : ` <tspan class="dial-time">${time(e.start)}</tspan>`}</text>`;
    }
    s += evBar(a, barY - 2, Math.max(6, b - a), 8, e.personal);
  });
  if (p.now) {
    const N = x(mins(p.now));
    s += `<rect x="${N - 2}" y="0" width="4" height="${scaleY + 10}" fill="${col("now")}"/>`;
  }
  return `<div class="c-cal dial"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg></div>`;
}

/* ------------------------------------------------------------------ */
/* daylight: sun arc                                                   */
/* props: { sunrise: "06:31", sunset: "16:46", now?: "06:40", delta?: "2 min shorter" } */
export function daylight(p, box) {
  const W = box.w;
  const R = Math.floor(Math.min(W / 2 - 14, (box.h || 140) - 40));
  const cx = Math.floor(W / 2), cy = R + 12;
  const rise = mins(p.sunrise), set = mins(p.sunset), len = set - rise;
  const k = p.now ? clamp((mins(p.now) - rise) / len, 0, 1) : 0;
  const ang = (t) => Math.PI * (1 - t);
  let dots = "";
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = ang(i / n);
    const X = cx + R * Math.cos(a), Y = cy - R * Math.sin(a);
    dots += i / n <= k
      ? `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="3" fill="${INK.ink}"/>`
      : `<rect x="${Math.round(X) - 1}" y="${Math.round(Y) - 1}" width="2" height="2" fill="${INK.ink}"/>`;
  }
  const sx = cx + R * Math.cos(ang(k)), sy = cy - R * Math.sin(ang(k));
  const sun = `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="10" fill="${col("sun")}" stroke="${INK.ink}" stroke-width="2"/>`;
  const H = cy + 24;
  return `<div class="c-daylight">
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect x="0" y="${cy}" width="${W}" height="2" fill="${INK.ink}"/>${dots}${sun}
      <text class="dl-len" x="${cx}" y="${cy - 10}" text-anchor="middle">${dur(len)}</text>
      <g class="svg-small"><text x="0" y="${cy + 20}">${time(p.sunrise)}</text><text x="${W}" y="${cy + 20}" text-anchor="end">${time(p.sunset)}</text></g>
    </svg>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* travel: when to leave for the first in-person thing                 */
/* props: { to: "Industry City", leaveBy: "08:52", minutes: 23, line?: "G", mode?: "subway"|"walk"|"bike", urgent?: bool } */
const LINE_INK = { G: "green", A: "blue", C: "blue", E: "blue" };
export function travel(p, box) {
  const bullet = p.line
    ? `${p.urgent ? `<span class="dot" style="background:${col("act")}"></span>` : ""}<svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="14" fill="${INK[LINE_INK[p.line] || "ink"]}"/><text x="14" y="20" text-anchor="middle" class="bullet">${esc(p.line)}</text></svg>`
    : "";
  const narrow = box.w < 240;
  return `<div class="c-travel ${narrow ? "narrow" : ""}">
    <div class="row gap1 travel-line"><div class="display">${ap(p.leaveBy)}</div>${bullet}</div>
    <div class="small"><b>Leave for ${esc(p.to)}</b></div>
    <div class="small">${p.minutes} min${p.line ? ` on the ${esc(p.line)}` : p.mode === "walk" ? " on foot" : ""}</div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* plants: the weekly watering reminder                                */
/* props: { state: "upcoming"|"weekend"|"due"|"overdue"|"done",         */
/*          due: "2026-11-08", daysLate?: 1..3 }                        */
/* Loudness escalates with state: a quiet line, an accent line, an     */
/* accent block, a growing block with one dot per late day.            */
export function plants(p, box) {
  const narrow = box.w < 300 ? " narrow" : "";
  const dueDay = new Date(`${p.due}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  const icon = (fill) => `<svg width="24" height="28" viewBox="0 0 24 28"><path d="M12 15 C12 9 8 4 2 3 C2 9 6 14 12 15 Z M12 15 C12 8 15 3 22 1 C22 8 18 14 12 15 Z" fill="${fill}"/><rect x="11" y="13" width="2" height="5" fill="${fill}"/><path d="M4 18 H20 L18 28 H6 Z" fill="${fill}"/></svg>`;
  const mark = (size = "") => `<span class="dot ${size}" style="background:${col("act")}"></span>`;
  const inv = T.block === "inverse";
  const fg = inv ? INK.paper : INK.ink;
  switch (p.state) {
    case "done":
      return `<div class="c-plants quiet row gap1"><span class="dot" style="background:${col("done")}"></span><div class="small">Plants watered ${esc(p.wateredOn || "")}</div></div>`;
    case "upcoming":
      return `<div class="c-plants quiet row gap1">${icon(INK.ink)}<div class="small">Water the plants ${dueDay}</div></div>`;
    case "weekend":
      return `<div class="c-plants weekend row gap1">${inv ? icon(INK.ink) : mark() + icon(INK.ink)}<div class="stack"><div class="body"><b>Water the plants this weekend</b></div><div class="small">Due ${dueDay}. Today or tomorrow works.</div></div></div>`;
    case "due":
      return `<div class="c-plants act ${inv ? "inverse" : "framed-0"}${narrow}">${inv ? "" : mark()}${icon(fg)}<div class="stack"><div class="title">Water the plants</div><div class="small">Today</div></div></div>`;
    case "overdue": {
      const n = clamp(p.daysLate || 1, 1, 3);
      const dots = Array.from({ length: n }, () => `<span class="dot lg" style="background:${col("lateDot")}"></span>`).join("");
      return `<div class="c-plants act ${inv ? "inverse" : "framed"} late-${n}${narrow}">${icon(fg)}<div class="stack"><div class="title">Water the plants</div><div class="small">${n === 1 ? "A day late" : `${n} days late`}</div></div><div class="late-dots row gap1">${dots}</div></div>`;
    }
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* note: a line left by the owner or one of their agents               */
/* props: { text, from: "Nima" | "<agent name>", at?: "23:42" }         */
export function note(p, box) {
  const long = p.text.length > 70;
  return `<div class="c-note">
    <div class="${long ? "body" : "title"} note-text">${esc(p.text)}</div>
    <div class="small">${esc(p.from)}${p.at ? `, ${time(p.at)}` : ""}</div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* poster: a typographic statement of the day's dominant fact          */
/* props: { text: "Rain from three.", sub?: "Take the umbrella.", ink?: "ink"|"blue" } */
export function poster(p, box) {
  const size = p.text.length <= 8 ? "giant" : "hero";
  return `<div class="c-poster" style="width:${box.w}px;height:${box.h}px">
    <div class="${size} poster-text" style="color:${INK[p.ink || "ink"]}">${esc(p.text)}</div>
    ${p.sub ? `<div class="title poster-sub">${esc(p.sub)}</div>` : ""}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* canvas: the free slot. Sonnet writes SVG; renderer validates it.    */
/* props: { svg: "<svg ...>", dither?: bool }  or a named generator:   */
/*        { gen: "grille" | "sunpath" | "quiet", seed, ... }           */
export function canvas(p, box) {
  const body = p.svg ?? (GENERATORS[p.gen] ? GENERATORS[p.gen](p, box) : "");
  return `<div class="c-canvas" ${p.dither ? "data-dither" : ""} style="width:${box.w}px;height:${box.h}px">${body}</div>`;
}

const GENERATORS = {
  /* Ambient: speaker grille with a few coloured control buttons, seeded by date. */
  grille(p, { w, h }) {
    const R = rng(p.seed || "x");
    const pitch = 16, cols = Math.floor(w / pitch), rows = Math.floor(h / pitch);
    const keys = new Map();
    const palette = ["green", "yellow", "red"];
    const count = 1 + Math.floor(R() * 2);
    for (let i = 0; i < count; i++) keys.set(`${Math.floor(R() * cols)},${Math.floor(R() * rows)}`, palette[i % palette.length]);
    // a circular void, like the grille around a dial
    const vc = { x: Math.floor(cols * (0.3 + R() * 0.4)), y: Math.floor(rows * (0.3 + R() * 0.4)), r: 4 + Math.floor(R() * 4) };
    let s = "";
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const d = Math.hypot(c - vc.x, r - vc.y);
      const cx = c * pitch + pitch / 2 + (w - cols * pitch) / 2, cy = r * pitch + pitch / 2 + (h - rows * pitch) / 2;
      if (d < vc.r) continue;
      const k = keys.get(`${c},${r}`);
      s += k ? `<circle cx="${cx}" cy="${cy}" r="7" fill="${INK[k]}"/>` : `<circle cx="${cx}" cy="${cy}" r="${d < vc.r + 1.5 ? 3.5 : 2.5}" fill="${INK.ink}"/>`;
    }
    const X = vc.x * pitch + pitch / 2 + (w - cols * pitch) / 2, Y = vc.y * pitch + pitch / 2 + (h - rows * pitch) / 2;
    s += `<circle cx="${X}" cy="${Y}" r="${(vc.r - 1.5) * pitch}" fill="none" stroke="${INK.ink}" stroke-width="2"/>`;
    s += `<rect x="${X - 1}" y="${Y - (vc.r - 1.5) * pitch}" width="3" height="${(vc.r - 1.5) * pitch * 0.7}" fill="${INK.ink}"/>`;
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`;
  },

  /* Ambient: the sun's path as nested arcs, no numbers. */
  sunpath(p, { w, h }) {
    const R = rng(p.seed || "y");
    const cx = Math.round(w * (0.18 + R() * 0.14)), cy = h - 40;
    let s = `<rect x="0" y="${cy}" width="${w}" height="3" fill="${INK.ink}"/>`;
    const bands = ["yellow", "ink", "ink", "ink"];
    for (let i = 0; i < 9; i++) {
      const r = 40 + i * 34;
      const ink = i < 4 ? bands[i] : "ink";
      const sw = i === 0 ? 14 : i < 4 ? 6 : 2;
      s += `<path d="M${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${INK[ink]}" stroke-width="${sw}"/>`;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="20" fill="${INK.ink}"/>`;
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${s}</svg>`;
  },

  /* Quiet day: one word, one dot. */
  quiet(p, { w, h }) {
    return `<div class="quiet-word">${esc(p.word || "Clear.")}</div><span class="dot quiet-dot" style="background:${INK[p.dot || "yellow"]}"></span>`;
  },
};

/* ------------------------------------------------------------------ */
/* line: one quiet sentence, for footers                               */
/* props: { text }                                                     */
export function line(p) {
  return `<div class="small c-line">${esc(p.text)}</div>`;
}

export const REGISTRY = { line, dateline, weather, nextEvent, calendar, daylight, travel, plants, note, poster, canvas };
