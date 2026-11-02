/**
 * Runs in the page (pass to page.evaluate) before the screenshot.
 * Any .slot whose content spills its box gets its text scaled down in 6%
 * steps until it fits, but never below 14px (the panel's legibility floor).
 * Model-written copy varies in length; layouts must still always fit.
 * Returns the slots it had to shrink, as "slot@scale".
 */
export function fitSlots() {
  const FLOOR = 14;
  const spills = (e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1;
  const shrunk = [];
  for (const slot of document.querySelectorAll(".slot")) {
    if (!spills(slot)) continue;
    const texts = [...slot.querySelectorAll("*")].filter((el) =>
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !el.closest("svg"));
    const base = texts.map((el) => {
      const cs = getComputedStyle(el);
      return { el, size: parseFloat(cs.fontSize), lh: cs.lineHeight === "normal" ? null : parseFloat(cs.lineHeight) };
    });
    let s = 1;
    while (spills(slot) && s > 0.4) {
      s -= 0.06;
      let floored = true;
      for (const b of base) {
        const px = Math.max(FLOOR, b.size * s);
        if (px > FLOOR) floored = false;
        b.el.style.fontSize = `${px}px`;
        if (b.lh) b.el.style.lineHeight = `${Math.max(FLOOR * 1.15, b.lh * s)}px`;
      }
      if (floored) break;
    }
    shrunk.push(`${slot.dataset.slot || "?"}@${s.toFixed(2)}`);
  }
  return shrunk;
}
