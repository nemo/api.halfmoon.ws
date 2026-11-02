// Screen JSON -> 600x448 PNG on the panel's seven inks.
// Headless Chromium: @sparticuz/chromium on Vercel, a local Chrome in dev.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PNG } from "pngjs";
import { compose as composeHtml, validate } from "./design/src/compose.mjs";
import { quantise } from "./design/quantise.mjs";
import { fitSlots } from "./design/src/fit.mjs";
import { CSS } from "./design/assets.mjs";

export const W = 600, H = 448;

export function toHtml(screen) {
  return composeHtml(screen, { cssHref: "about:blank" })
    .replace(/<link rel="stylesheet" href="about:blank">/, `<style>${CSS}</style>`);
}

export { validate };

/* ---- browser ---- */
let browserP;
const onServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

function localChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ];
  const cache = path.join(process.env.HOME || "", "Library/Caches/ms-playwright");
  if (fs.existsSync(cache)) {
    for (const d of fs.readdirSync(cache).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse())
      candidates.push(path.join(cache, d, "chrome-headless-shell-mac-arm64", "chrome-headless-shell"));
  }
  return candidates.find((p) => p && fs.existsSync(p));
}

async function launch() {
  const puppeteer = (await import("puppeteer-core")).default;
  if (onServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(process.env.CHROMIUM_PACK_URL || undefined),
      headless: true,
      defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
    });
  }
  const executablePath = localChrome();
  if (!executablePath) throw new Error("No Chrome found. Set CHROME_PATH.");
  return puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] });
}

async function browser() {
  if (browserP) {
    const b = await browserP.catch(() => null);
    if (b?.connected) return b;
  }
  browserP = launch();
  return browserP;
}

/**
 * @returns {Promise<{png: Buffer, raw: Buffer, hash: string, overflow: string[], indices: Uint8Array}>}
 */
export async function renderScreen(screen) {
  const html = toHtml(screen);
  const b = await browser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(fitSlots);
    const overflow = await page.$$eval(".slot", (els) =>
      els.filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)
        .map((e) => `${e.dataset.slot} (${e.scrollWidth}x${e.scrollHeight} in ${e.clientWidth}x${e.clientHeight})`));
    const dither = await page.$$eval("[data-dither]", (els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }));
    const raw = Buffer.from(await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }));
    const img = PNG.sync.read(raw);
    const indices = quantise(img, dither);
    const png = PNG.sync.write(img, { colorType: 2 });
    const hash = crypto.createHash("sha1").update(indices).digest("hex").slice(0, 16);
    return { png, raw, hash, overflow, indices };
  } finally {
    await page.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (!browserP) return;
  const b = await browserP.catch(() => null);
  browserP = null;
  await b?.close().catch(() => {});
}
