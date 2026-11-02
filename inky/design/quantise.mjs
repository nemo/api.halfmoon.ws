// Map a browser render onto the panel's seven inks.
//
// Browsers antialias. A naive nearest-colour pass turns the grey edge of black
// type into dark blue or green, because those inks sit closer to mid-grey than
// black does. Instead, each pixel is explained as a blend of the two inks that
// best reproduce it (edge pixels are always a blend of the foreground and the
// background), then snapped to whichever of the two it is mostly made of. Thin
// strokes get a slight bias toward the ink side so 1px rules and small type
// survive. Regions marked [data-dither] (real gradients) use Floyd–Steinberg
// error diffusion instead.

export const PALETTE = [
  [57, 48, 57],    // 0 ink
  [255, 255, 255], // 1 paper
  [58, 91, 70],    // 2 green
  [61, 59, 94],    // 3 blue
  [156, 72, 75],   // 4 red
  [208, 190, 71],  // 5 yellow
  [177, 106, 73],  // 6 orange
];
const PAPER = 1;
const INK_BIAS = 0.42; // coverage at which an ink-on-paper edge pixel becomes ink

const PAIRS = [];
for (let a = 0; a < PALETTE.length; a++) for (let b = a + 1; b < PALETTE.length; b++) PAIRS.push([a, b]);

function snapPixel(r, g, b) {
  let best = null, bestErr = Infinity, bestT = 0;
  for (const [ia, ib] of PAIRS) {
    const A = PALETTE[ia], B = PALETTE[ib];
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2];
    const dd = dx * dx + dy * dy + dz * dz;
    let t = ((r - A[0]) * dx + (g - A[1]) * dy + (b - A[2]) * dz) / dd;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const er = r - (A[0] + t * dx), eg = g - (A[1] + t * dy), eb = b - (A[2] + t * dz);
    const err = er * er + eg * eg + eb * eb;
    if (err < bestErr) { bestErr = err; best = [ia, ib]; bestT = t; }
  }
  const [ia, ib] = best;
  // t is the share of B. Bias toward the non-paper ink on ink/paper edges.
  if (ia === PAPER) return bestT >= INK_BIAS ? ib : ia;
  if (ib === PAPER) return 1 - bestT >= INK_BIAS ? ia : ib;
  return bestT >= 0.5 ? ib : ia;
}

function nearest(r, g, b) {
  let bi = 0, be = Infinity;
  for (let i = 0; i < PALETTE.length; i++) {
    const P = PALETTE[i];
    const e = (r - P[0]) ** 2 * 0.3 + (g - P[1]) ** 2 * 0.59 + (b - P[2]) ** 2 * 0.11;
    if (e < be) { be = e; bi = i; }
  }
  return bi;
}

/**
 * @param {{width:number,height:number,data:Uint8Array}} img RGBA
 * @param {{x:number,y:number,w:number,h:number}[]} ditherRects
 * @returns {Uint8Array} palette index per pixel; img.data is rewritten in place
 */
export function quantise(img, ditherRects = []) {
  const { width: W, height: H, data } = img;
  const idx = new Uint8Array(W * H);
  const inDither = new Uint8Array(W * H);
  for (const r of ditherRects) {
    for (let y = Math.max(0, r.y); y < Math.min(H, r.y + r.h); y++)
      for (let x = Math.max(0, r.x); x < Math.min(W, r.x + r.w); x++) inDither[y * W + x] = 1;
  }

  // edge-aware snap everywhere outside dither regions, memoised by colour
  const memo = new Map();
  for (let i = 0; i < W * H; i++) {
    if (inDither[i]) continue;
    const o = i * 4, key = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
    let v = memo.get(key);
    if (v === undefined) { v = snapPixel(data[o], data[o + 1], data[o + 2]); memo.set(key, v); }
    idx[i] = v;
  }

  // Floyd–Steinberg inside dither regions
  if (ditherRects.length) {
    const buf = new Float32Array(W * H * 3);
    for (let i = 0; i < W * H; i++) { buf[i * 3] = data[i * 4]; buf[i * 3 + 1] = data[i * 4 + 1]; buf[i * 3 + 2] = data[i * 4 + 2]; }
    const push = (x, y, e, f) => {
      if (x < 0 || x >= W || y >= H || !inDither[y * W + x]) return;
      const j = (y * W + x) * 3; buf[j] += e[0] * f; buf[j + 1] += e[1] * f; buf[j + 2] += e[2] * f;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!inDither[i]) continue;
      const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
      const k = nearest(r, g, b), P = PALETTE[k];
      idx[i] = k;
      const e = [r - P[0], g - P[1], b - P[2]];
      push(x + 1, y, e, 7 / 16); push(x - 1, y + 1, e, 3 / 16); push(x, y + 1, e, 5 / 16); push(x + 1, y + 1, e, 1 / 16);
    }
  }

  for (let i = 0; i < W * H; i++) {
    const P = PALETTE[idx[i]];
    data[i * 4] = P[0]; data[i * 4 + 1] = P[1]; data[i * 4 + 2] = P[2]; data[i * 4 + 3] = 255;
  }
  return idx;
}
