// Skeleton + facts -> renderable screen.
//
// A skeleton is what the model (or a fallback) decides: template, which
// component goes where, variants, and copy (poster text, canvas SVG, quiet
// word). Facts always come from the data layer, so the same skeleton can be
// re-filled with fresh weather and times all morning without a model call.

import { sanitizeSvg } from "./sanitize.mjs";
import { TEMPLATES } from "./design/src/templates.mjs";
import { mins } from "./time.mjs";

const evProps = (e) => ({ start: e.start, end: e.end, title: e.title, where: e.where, personal: !!e.personal });

/** Facts for one data component, or null if there's nothing true to show. */
function facts(component, model, d) {
  const now = d.at.hhmm;
  switch (component) {
    case "dateline":
      return { date: d.day, place: d.place, updated: now };
    case "weather":
      return d.weather ? { ...d.weather } : null;
    case "nextEvent":
      return d.next ? { title: d.next.title, start: d.next.start, inMinutes: d.next.inMinutes, where: d.next.where } : null;
    case "calendar": {
      const all = d.calendar?.events || [];
      if (!all.length) return null;
      const variant = model.variant || "list";
      const events = variant === "list" ? all.filter((e) => mins(e.end) > mins(now)) : all;
      if (!events.length) return null;
      return {
        events: events.map(evProps), now,
        from: model.props?.from ?? (variant === "dial" ? 6 : 7),
        to: model.props?.to ?? (variant === "dial" ? 22 : 21),
        max: model.props?.max ?? 3,
      };
    }
    case "daylight":
      return d.sun ? { sunrise: d.sun.sunrise, sunset: d.sun.sunset, now, delta: d.sun.delta } : null;
    case "travel":
      return d.travel ? { ...d.travel } : null;
    case "plants":
      return d.plants ? { ...d.plants } : null;
    case "note": {
      const n = d.notes?.[model.props?.index ?? 0];
      if (!n) return null;
      return { text: n.text, from: n.from, at: n.at ? clock(n.at) : undefined };
    }
    default:
      return undefined; // copy components: keep the model's props
  }
}

const clock = (iso) => new Intl.DateTimeFormat("en-GB", {
  timeZone: process.env.INKY_TZ || "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(iso));

/**
 * @param {object} skeleton  { template, theme?, direction?, slots: { area: block | block[] } }
 * @param {object} d         gatherDay() output
 * @returns {{screen: object, dropped: string[], issues: string[]}}
 */
export function fill(skeleton, d) {
  const t = TEMPLATES[skeleton.template];
  const dropped = [], issues = [];
  const slots = {};
  for (const [area, val] of Object.entries(skeleton.slots || {})) {
    const box = t?.areas?.[area];
    const blocks = [];
    for (const b of [].concat(val || [])) {
      if (!b?.component) continue;
      const f = facts(b.component, b, d);
      if (f === null) { dropped.push(`${area}:${b.component}`); continue; }
      let props = f === undefined ? { ...(b.props || {}) } : f;
      if (b.component === "canvas" && typeof props.svg === "string" && box) {
        const s = sanitizeSvg(props.svg, box);
        props = { ...props, svg: s.svg };
        issues.push(...s.issues.map((i) => `canvas: ${i}`));
      }
      if (b.component === "poster" && !props.text) { dropped.push(`${area}:poster(no text)`); continue; }
      blocks.push({ component: b.component, ...(b.variant ? { variant: b.variant } : {}), props });
    }
    if (blocks.length) slots[area] = blocks.length === 1 ? blocks[0] : blocks;
  }
  return {
    screen: { name: skeleton.direction || skeleton.template, template: skeleton.template, theme: skeleton.theme || process.env.INKY_THEME || undefined, slots },
    dropped, issues,
  };
}
