// Today's events from secret iCal URLs.
//   ICAL_URLS="work|https://calendar.google.com/...basic.ics,personal|https://..."
//   ICAL_OWNER_EMAILS="me@work.com,me@gmail.com"  (optional; improves declined/OOO filtering)
// Untagged URLs count as work.

import ical from "node-ical";
import { local, instant, addDays, mins } from "../time.mjs";

const ONLINE = /(zoom\.us|meet\.google|teams\.microsoft|webex|whereby|^https?:\/\/|^zoom$|^google meet$|^meet$|^teams$|^phone$|^call$)/i;
const OOO = /\b(ooo|out of office|out-of-office|pto|vacation|holiday|off)\b/i;

export function parseSources(env = process.env.ICAL_URLS || "") {
  return env.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = s.match(/^(work|personal)\|(.+)$/i);
    return m ? { tag: m[1].toLowerCase(), url: m[2] } : { tag: "work", url: s };
  });
}

const owners = () => (process.env.ICAL_OWNER_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const email = (v) => String((v && (v.val || v)) || "").replace(/^mailto:/i, "").toLowerCase();

function calOwner(parsed) {
  const cal = Object.values(parsed).find((c) => c.type === "VCALENDAR");
  const name = cal?.["WR-CALNAME"] || "";
  return /@/.test(name) ? name.toLowerCase() : null;
}

function declinedBy(ev, me) {
  const att = [].concat(ev.attendee || []);
  return att.some((a) => me.includes(email(a)) && String(a?.params?.PARTSTAT || "").toUpperCase() === "DECLINED");
}

export const isPhysical = (where) => !!where && !ONLINE.test(where.trim()) && where.trim().length > 2;

/** Pure: parsed ICS objects -> today's normalised events. */
export function eventsForDay(parsedList, day) {
  const from = instant(day, "00:00"), to = instant(addDays(day, 1), "00:00");
  const out = [];
  for (const { parsed, tag } of parsedList) {
    const me = [...owners(), calOwner(parsed)].filter(Boolean);
    for (const ev of Object.values(parsed)) {
      if (ev.type !== "VEVENT" || String(ev.status || "").toUpperCase() === "CANCELLED") continue;
      let instances;
      try { instances = ical.expandRecurringEvent(ev, { from, to, expandOngoing: true }); } catch { continue; }
      for (const inst of instances) {
        const src = inst.event || ev;
        if (me.length && declinedBy(src, me)) continue;
        const title = String(inst.summary || src.summary || "Busy").trim();
        const where = String(src.location || "").trim() || undefined;
        if (inst.isFullDay) {
          const org = email(src.organizer);
          const others = org && me.length && !me.includes(org);
          if (others || OOO.test(title)) continue;          // colleagues' OOO and all-day noise
          if (String(src.transparency || "").toUpperCase() === "TRANSPARENT" && tag === "work") continue; // working-location markers
          out.push({ allDay: true, title, where, personal: tag === "personal" });
          continue;
        }
        const s = new Date(inst.start), e = new Date(inst.end || inst.start);
        if (e <= from || s >= to) continue;
        const start = s < from ? "00:00" : local(s).hhmm;
        const end = e >= to ? "23:59" : local(e).hhmm;
        out.push({ start, end, title, where, personal: tag === "personal", physical: isPhysical(where), startsAt: s.toISOString() });
      }
    }
  }
  // de-dupe the same meeting seen on two calendars
  const seen = new Set();
  return out
    .filter((e) => { const k = `${e.allDay ? "all" : e.start}|${e.title.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (a.allDay ? -1 : mins(a.start)) - (b.allDay ? -1 : mins(b.start)));
}

// The work feed is huge (~23 MB, ~20 s to download), so a day's parsed events
// are cached for 30 min, and the last good copy is reused for up to a day if
// a refresh fails.
const FRESH_MS = 30 * 60 * 1000;
async function fetchFresh(day) {
  const sources = parseSources();
  if (!sources.length) return { events: [], allDay: [], ok: false, reason: "ICAL_URLS unset" };
  const parsedList = [];
  const errors = [];
  await Promise.all(sources.map(async ({ tag, url }) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      parsedList.push({ tag, parsed: ical.sync.parseICS(await res.text()) });
    } catch (e) { errors.push(`${tag}: ${e.message}`); }
  }));
  const all = eventsForDay(parsedList, day);
  return { events: all.filter((e) => !e.allDay), allDay: all.filter((e) => e.allDay), ok: !errors.length, errors };
}

export async function fetchCalendars(day) {
  const { store } = await import("../state.mjs");
  const key = `cal:${day}`;
  const cached = await store.get(key).catch(() => null);
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.data;
  const fresh = await fetchFresh(day);
  if (fresh.ok) {
    await store.set(key, { at: Date.now(), data: fresh }, 26 * 3600).catch(() => {});
    return fresh;
  }
  return cached ? { ...cached.data, stale: true, errors: fresh.errors } : fresh;
}
