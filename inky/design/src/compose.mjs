// Screen JSON -> HTML document. This is the contract Sonnet writes against.
//
// {
//   "template": "rail",
//   "slots": {
//     "header": { "component": "dateline", "props": { ... } },
//     "rail":   [ { "component": "nextEvent", "props": { ... } }, ... ]
//   }
// }

import { REGISTRY } from "./components.mjs";
import { esc, setTheme } from "./lib.mjs";
import { TEMPLATES } from "./templates.mjs";

export function validate(screen) {
  const errors = [];
  const t = TEMPLATES[screen.template];
  if (!t) return [`unknown template "${screen.template}"`];
  for (const [slot, val] of Object.entries(screen.slots || {})) {
    if (!t.areas[slot]) errors.push(`template "${screen.template}" has no area "${slot}"`);
    for (const b of [].concat(val)) if (!REGISTRY[b.component]) errors.push(`unknown component "${b.component}" in "${slot}"`);
  }
  return errors;
}

export function compose(screen, { cssHref = "../src/components.css", outline = false } = {}) {
  setTheme(screen.theme || "mono");
  const errors = validate(screen);
  if (errors.length) throw new Error(errors.join("; "));
  const t = TEMPLATES[screen.template];
  let body = "";
  for (const h of t.hairs) body += `<div class="hair" style="left:${h.x}px;top:${h.y}px;width:${h.w}px"></div>`;
  for (const h of t.vhairs || []) body += `<div class="vhair" style="left:${h.x}px;top:${h.y}px;height:${h.h}px"></div>`;

  for (const [name, a] of Object.entries(t.areas)) {
    const val = screen.slots?.[name];
    if (outline) {
      body += `<div class="area checker" style="left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px"></div>`;
      body += `<div class="area-label" style="left:${a.x + 6}px;top:${a.y + 4}px;background:#fff;padding:0 4px">${esc(name)} ${a.w}×${a.h}</div>`;
      continue;
    }
    if (!val) continue;
    const blocks = [].concat(val);
    const inner = blocks
      .map((b) => REGISTRY[b.component](b.props || {}, { w: a.w, h: blocks.length > 1 ? undefined : a.h, variant: b.variant }))
      .join("");
    body += `<div class="area slot ${blocks.length > 1 ? "stacked" : ""}" data-slot="${name}" style="left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px">${inner}</div>`;
  }

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(screen.name || screen.template)}</title>
<link rel="stylesheet" href="${cssHref}">
</head><body data-theme="${esc(screen.theme || "green")}"><div class="screen" style="display:block;padding:0">${body}</div></body></html>`;
}
