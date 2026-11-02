// Allowlist sanitiser for the model's free-canvas SVG.
// Keeps a small vocabulary of shape elements, palette colours only, no
// scripts, styles, foreignObject, links, external refs, filters or opacity
// (opacity creates blends the panel can't show).

const PALETTE = {
  ink: "#393039", paper: "#ffffff", red: "#9c484b", blue: "#3d3b5e", yellow: "#d0be47", green: "#3a5b46",
};
const HEX = new Set(Object.values(PALETTE));
const ALIASES = { black: PALETTE.ink, white: PALETTE.paper, "#fff": PALETTE.paper, "#000": PALETTE.ink, "#000000": PALETTE.ink };

const ELEMENTS = new Set(["svg", "g", "rect", "circle", "ellipse", "line", "polyline", "polygon", "path", "text", "tspan"]);
const DROP_WITH_CONTENT = new Set(["script", "style", "foreignobject", "a", "image", "use", "iframe", "metadata", "title", "desc", "defs", "lineargradient", "radialgradient", "pattern", "mask", "clippath", "filter", "animate", "set", "symbol"]);
const ATTRS = new Set([
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "d", "points", "viewbox",
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "transform",
  "text-anchor", "dominant-baseline", "font-size", "font-weight", "font-stretch", "letter-spacing", "fill-rule",
]);
const COLOUR_ATTRS = new Set(["fill", "stroke"]);
const NUMERIC = /^[-0-9.,\s]+$/;
const SAFE_VALUE = /^[-a-zA-Z0-9.,%#()\s]+$/;

export function colour(v) {
  const s = String(v).trim().toLowerCase();
  if (s === "none") return "none";
  if (PALETTE[s]) return PALETTE[s];
  if (ALIASES[s]) return ALIASES[s];
  if (HEX.has(s)) return s;
  return null;
}

const esc = (s) => s.replace(/&(?!(amp|lt|gt|quot|apos|#\d+);)/g, "&amp;");

function cleanAttrs(raw, el, issues) {
  const out = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    let val = m[3] ?? m[4] ?? "";
    if (!ATTRS.has(name)) { issues.push(`attr ${name} on <${el}>`); continue; }
    if (/url\(|javascript:|data:|expression|&/i.test(val)) { issues.push(`value ${name}`); continue; }
    if (COLOUR_ATTRS.has(name)) {
      const c = colour(val);
      if (!c) { issues.push(`colour ${val}`); val = name === "fill" ? PALETTE.ink : "none"; } else val = c;
    } else if (name === "d" || name === "points") {
      if (!/^[-MmLlHhVvCcSsQqTtAaZz0-9.,eE\s]+$/.test(val)) { issues.push(`path data`); continue; }
    } else if (name === "transform") {
      if (!/^((translate|rotate|scale)\([-0-9.,\s]+\)\s*)+$/.test(val)) { issues.push(`transform ${val}`); continue; }
    } else if (!SAFE_VALUE.test(val)) { issues.push(`value ${name}`); continue; }
    const key = name === "viewbox" ? "viewBox" : name;
    out.push(`${key}="${val}"`);
  }
  return out;
}

/**
 * @param {string} svg   model output
 * @param {{w:number,h:number}} box   the slot's size; the root svg is forced to it
 * @returns {{svg: string, issues: string[]}}
 */
export function sanitizeSvg(svg, box) {
  const issues = [];
  if (typeof svg !== "string") return { svg: "", issues: ["not a string"] };
  const src = svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "");

  const tag = /<\s*(\/?)\s*([a-zA-Z][-a-zA-Z0-9:]*)([^>]*?)(\/?)\s*>/g;
  let out = "", last = 0, dropDepth = 0, dropName = null, stack = [], sawRoot = false, m;
  while ((m = tag.exec(src))) {
    const text = src.slice(last, m.index);
    last = tag.lastIndex;
    if (!dropDepth && stack.length && /\S/.test(text) && ["text", "tspan"].includes(stack[stack.length - 1])) out += esc(text.replace(/[<>]/g, ""));
    const closing = !!m[1], name = m[2].toLowerCase().replace(/^svg:/, ""), selfClose = !!m[4];

    if (dropDepth) {
      if (name === dropName) dropDepth += closing ? -1 : selfClose ? 0 : 1;
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      issues.push(`<${name}> removed`);
      if (!closing && !selfClose) { dropDepth = 1; dropName = name; }
      continue;
    }
    if (!ELEMENTS.has(name)) { issues.push(`<${name}> unwrapped`); continue; }
    if (closing) {
      const i = stack.lastIndexOf(name);
      if (i === -1) continue;
      while (stack.length > i) out += `</${stack.pop()}>`;
      continue;
    }
    let attrs = cleanAttrs(m[3], name, issues);
    if (name === "svg" && !sawRoot && !stack.length) {
      sawRoot = true;
      const vb = attrs.find((a) => a.startsWith("viewBox="));
      attrs = [`xmlns="http://www.w3.org/2000/svg"`, `width="${box.w}"`, `height="${box.h}"`, vb || `viewBox="0 0 ${box.w} ${box.h}"`];
    } else if (name === "svg") { issues.push("nested <svg> unwrapped"); continue; }
    out += `<${name}${attrs.length ? " " + attrs.join(" ") : ""}${selfClose ? "/>" : ">"}`;
    if (!selfClose) stack.push(name);
  }
  while (stack.length) out += `</${stack.pop()}>`;
  if (!sawRoot) out = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="0 0 ${box.w} ${box.h}">${out}</svg>`;
  return { svg: out, issues };
}

export const CANVAS_COLOURS = PALETTE;
