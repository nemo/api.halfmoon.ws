// Grid templates. Each is a set of named areas in device pixels on the
// 600x448 canvas (24px margins, 12 x 35px columns, 12px gutters, 8px baseline),
// plus hairlines. A screen fills areas with components; an area given an array
// stacks its components with a rule between them.

const HEADER = { x: 24, y: 24, w: 552, h: 32 };
const HEADER_RULE = { x: 24, y: 64, w: 552 };

export const TEMPLATES = {
  /* main field left, instrument rail right */
  rail: {
    note: "A wide main area (canvas, weather field, poster) and a stacked rail of small modules.",
    areas: {
      header: HEADER,
      main: { x: 24, y: 80, w: 317, h: 344 },
      rail: { x: 365, y: 80, w: 211, h: 344 },
    },
    hairs: [HEADER_RULE],
    vhairs: [{ x: 353, y: 80, h: 344 }],
  },

  /* one statement, three supporting modules */
  poster: {
    note: "A typographic statement across the top two-thirds; three equal modules below.",
    areas: {
      header: HEADER,
      poster: { x: 24, y: 76, w: 552, h: 228 },
      a: { x: 24, y: 328, w: 176, h: 96 },
      b: { x: 212, y: 328, w: 176, h: 96 },
      c: { x: 400, y: 328, w: 176, h: 96 },
    },
    hairs: [HEADER_RULE, { x: 24, y: 316, w: 552 }],
  },

  /* the day as a horizontal band */
  strip: {
    note: "Weather and daylight on top, the day's timeline across the middle, details below.",
    areas: {
      header: HEADER,
      tl: { x: 24, y: 80, w: 317, h: 112 },
      tr: { x: 365, y: 80, w: 211, h: 112 },
      band: { x: 24, y: 208, w: 552, h: 88 },
      bl: { x: 24, y: 312, w: 317, h: 112 },
      br: { x: 365, y: 312, w: 211, h: 112 },
    },
    hairs: [HEADER_RULE, { x: 24, y: 200, w: 552 }, { x: 24, y: 304, w: 552 }],
  },

  /* instrument: a wide scale, three dials below */
  dial: {
    note: "A full-width scale instrument above three equal modules.",
    areas: {
      header: HEADER,
      scale: { x: 24, y: 76, w: 552, h: 204 },
      a: { x: 24, y: 300, w: 176, h: 124 },
      b: { x: 212, y: 300, w: 176, h: 124 },
      c: { x: 400, y: 300, w: 176, h: 124 },
    },
    hairs: [HEADER_RULE, { x: 24, y: 288, w: 552 }],
  },

  /* almost nothing */
  quiet: {
    note: "One canvas and a single footer line. For days with little to say.",
    areas: {
      canvas: { x: 24, y: 24, w: 552, h: 360 },
      footer: { x: 24, y: 404, w: 552, h: 20 },
    },
    hairs: [{ x: 24, y: 396, w: 552 }],
  },

  /* contact-sheet layouts (not offered to the model) */
  sheet: { internal: true, areas: { all: { x: 24, y: 24, w: 552, h: 400 } }, hairs: [] },
  sheet2: {
    internal: true,
    areas: { left: { x: 24, y: 24, w: 264, h: 400 }, right: { x: 312, y: 24, w: 264, h: 400 } },
    hairs: [], vhairs: [{ x: 300, y: 24, h: 400 }],
  },

  /* ambient: edge to edge */
  full: {
    note: "Ambient mode. The canvas owns the whole panel.",
    areas: { canvas: { x: 0, y: 0, w: 600, h: 448 } },
    hairs: [],
  },
};
