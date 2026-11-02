import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeSvg } from "../sanitize.mjs";

const box = { w: 300, h: 200 };

test("keeps shapes, forces root size, maps palette names", () => {
  const { svg, issues } = sanitizeSvg(`<svg width="9999" viewBox="0 0 10 10"><rect x="1" y="2" width="3" height="4" fill="ink"/><circle cx="5" cy="5" r="2" fill="#3A5B46" stroke="none"/></svg>`, box);
  assert.equal(issues.length, 0);
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="300" height="200" viewBox="0 0 10 10">/);
  assert.match(svg, /<rect x="1" y="2" width="3" height="4" fill="#393039"\/>/);
  assert.match(svg, /fill="#3a5b46"/);
});

test("strips scripts, foreignObject, handlers, external refs, off-palette colours", () => {
  const evil = `<svg onload="alert(1)"><script>alert(1)</script><foreignObject><div>x</div></foreignObject>
    <image href="https://evil/x.png"/><rect fill="url(#g)" onclick="x()" style="fill:red" width="5" height="5"/>
    <circle r="3" fill="#ff00ff"/><a href="javascript:alert(1)"><text>hi</text></a></svg>`;
  const { svg, issues } = sanitizeSvg(evil, box);
  for (const bad of ["script", "alert", "foreignObject", "image", "url(", "onclick", "onload", "style", "#ff00ff", "javascript", "<a"]) {
    assert.ok(!svg.includes(bad), `${bad} survived: ${svg}`);
  }
  assert.ok(issues.length >= 5);
  assert.match(svg, /<circle r="3" fill="#393039"\/>/);
});

test("text content is escaped and kept", () => {
  const { svg } = sanitizeSvg(`<svg><text x="1" y="2" font-size="40">Rain &amp; wind</text></svg>`, box);
  assert.match(svg, /<text x="1" y="2" font-size="40">Rain &amp; wind<\/text>/);
});

test("wraps fragments without a root", () => {
  const { svg } = sanitizeSvg(`<circle cx="1" cy="1" r="1" fill="red"/>`, box);
  assert.match(svg, /^<svg [^>]*width="300" height="200"[^>]*><circle cx="1" cy="1" r="1" fill="#9c484b"\/><\/svg>$/);
});

import { toSkeleton } from "../compose.mjs";
test("model output -> skeleton: nulls stripped, header added, unknown areas tolerated", () => {
  const nul = { text: null, sub: null, ink: null, svg: null, gen: null, seed: null, word: null, dot: null, index: null, from: null, to: null, max: null };
  const sk = toSkeleton({
    direction: "poster", rationale: "x", template: "poster",
    slots: [
      { area: "poster", blocks: [{ component: "poster", variant: null, props: { ...nul, text: "Rain from three." } }] },
      { area: "a", blocks: [{ component: "plants", variant: null, props: nul }] },
      { area: "nowhere", blocks: [{ component: "note", variant: null, props: nul }] },
    ],
  });
  assert.deepEqual(sk.slots.header, { component: "dateline" });
  assert.deepEqual(sk.slots.poster, { component: "poster", props: { text: "Rain from three." } });
  assert.deepEqual(sk.slots.a, { component: "plants", props: {} });
  assert.equal(sk.slots.nowhere, undefined);
  assert.throws(() => toSkeleton({ template: "sheet", slots: [] }));
});
