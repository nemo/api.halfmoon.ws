// Shared helpers for components. Pure functions, no DOM.

export const INK = {
  ink: "#393039",
  paper: "#ffffff",
  orange: "#b16a49",
  red: "#9c484b",
  blue: "#3d3b5e",
  yellow: "#d0be47",
  green: "#3a5b46",
};

export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** "14:05" -> minutes since midnight */
export const mins = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
};

/** "14:05" -> { t: "2:05", ap: "pm" } */
export const t12 = (hhmm) => {
  const total = mins(hhmm);
  const h = Math.floor(total / 60), m = total % 60;
  const h12 = ((h + 11) % 12) + 1;
  return { t: m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`, ap: h < 12 ? "am" : "pm" };
};

/** "14:05" -> "2:05pm" */
export const time = (hhmm) => { const { t, ap } = t12(hhmm); return `${t}${ap}`; };

/** hour label for scales: 6, 9, 12, 3 ... */
export const hourLabel = (h) => String(((h + 11) % 12) + 1);

export const dur = (minutes) => {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * The grille: Braun's speaker perforation, used as the data texture.
 * cols x rows of holes on `pitch`. fill(c, r) returns an ink name for a solid
 * dot, or null for an empty hole. Empty holes are 2x2 pixel squares so they
 * read as perforation without turning into grey mush when quantised.
 */
export function grille({ cols, rows, pitch = 10, r = 3, fill, x0 = 0, y0 = 0 }) {
  let out = "";
  for (let c = 0; c < cols; c++) {
    for (let row = 0; row < rows; row++) {
      const cx = x0 + c * pitch + pitch / 2;
      const cy = y0 + row * pitch + pitch / 2;
      const ink = fill(c, row);
      if (ink) out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK[ink] || ink}"/>`;
      else out += `<rect x="${Math.round(cx) - 1}" y="${Math.round(cy) - 1}" width="2" height="2" fill="${INK.ink}"/>`;
    }
  }
  return out;
}

/** Tiny seeded PRNG so generative pieces are reproducible from a date. */
export function rng(seed) {
  let s = typeof seed === "string" ? [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) : seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Colour treatments. Monochrome first: colour is a small functional mark,
 * never a field. Components read the live theme `T`; compose() sets it.
 *   act      colour of the "do this" mark (dot, icon, frame accent)
 *   block    how a due/overdue action is drawn: "mark" (dot + bold ink line,
 *            framed when late) or "inverse" (black panel, paper type)
 *   lateDot  colour of the one-per-day-late dots
 *   now      the needle
 *   sun      sun disc fill (ink ring always)
 *   rain     water: rain dots and rules
 *   done     watered confirmation dot
 */
export const THEMES = {
  mono:    { label: "Monochrome + one red signal dot, blue for water", act: "red",   block: "mark",    lateDot: "red",    now: "ink", sun: "paper",  rain: "blue", done: "ink" },
  green:   { label: "Braun green for action, red only for now", act: "green", block: "mark", lateDot: "green", now: "red", sun: "yellow", rain: "blue", done: "green" },
  inverse: { label: "Black inverse panels, yellow sparingly", act: "ink", block: "inverse", lateDot: "yellow", now: "ink", sun: "yellow", rain: "blue", done: "ink" },
};
export const T = { ...THEMES.mono, name: "mono" };
export function setTheme(name = "mono") {
  Object.assign(T, THEMES[name] || THEMES.mono, { name: THEMES[name] ? name : "mono" });
  return T;
}
export const col = (role) => INK[T[role]] || INK[role] || role;
