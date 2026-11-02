# inky: the bathroom e-ink service

Server side of [inky-mirror](https://github.com/nemo/inky-mirror) v2. It renders a 600×448 PNG on the Inky Impression's 7 inks. The Pi only fetches frames and reports button presses.

- **04:00–11:00, morning.** Sonnet composes the layout once, on the first request after 4am, and it's cached for the day. The facts (weather, times, plants, notes) are refilled every `INKY_REFRESH_MINUTES` without another model call.
- **11:00–04:00, ambient.** One data-free piece per day: Sonnet SVG, or a built-in generator.

The design system lives in `inky-mirror/design` and is copied here by `yarn sync-design` (→ `inky/design/`, don't edit it there).

## Run locally

```sh
yarn install
INKY_FAKE=1 yarn start          # synthetic data, no keys needed, state in .inky-state.json
open "http://localhost:3001/inky/preview?date=2026-11-03&time=06:40&fake=1&direction=poster"
yarn test
```

Rendering uses local Chrome (or `CHROME_PATH`) in development, and `@sparticuz/chromium` on Vercel.

## Endpoints

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/inky/frame.png` | device | Current frame. `ETag`/`X-Inky-Hash` = frame hash; send `If-None-Match` to get `304` when nothing changed |
| GET | `/inky/frame.json` | device | What's on screen and why: direction, model or fallback, dropped modules, data errors |
| POST | `/inky/button/A` | device | Plants watered today (next due in 7 days) |
| POST | `/inky/button/B` · `/C` | device | 👍 / 👎 the current design direction; this steers future compositions |
| POST | `/inky/button/D` | device | Does nothing (spare) |
| POST | `/inky/notes` | notes or device | `{ "text": "...", "from": "..." }`, up to 160 characters. Shown the next morning |
| GET | `/inky/notes` | notes or device | Recent notes |
| GET | `/inky/preview` | device | `date`, `time`, `direction` (weather-field, instrument, poster, timeline, quiet), `fake=1`, `compose=1` (fresh model call), `fallback=1` (no model), `format=png|json|html|raw`. Persists nothing |
| GET | `/inky/health` | none | Which env vars are set, the store in use, and the current phase |

Auth is `Authorization: Bearer <token>`; `?token=` also works for previews in a browser. With no tokens set, the endpoints are open locally and closed on Vercel.

### Posting a note (you or an agent)

```sh
curl -X POST https://api.halfmoon.ws/inky/notes \
  -H "Authorization: Bearer $INKY_NOTES_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Call the super about the radiator.", "from": "house-agent"}'
```

Notes queue up. The next morning's composition claims every waiting note, and the model decides how to place them. Keep them short: one line reads best.

### The device loop (Pi)

```sh
curl -s -H "Authorization: Bearer $INKY_DEVICE_TOKEN" -H "If-None-Match: \"$LAST\"" \
  -D headers -o frame.png https://api.halfmoon.ws/inky/frame.png
# 200: push frame.png to the panel and store X-Inky-Hash as LAST. 304: do nothing.
```

The PNG already uses exactly the panel's palette. Map pixels to palette indices directly, and don't use `set_image(saturation=0.5)`, which re-dithers.

## Env

See `.env.example`. Required in production: `ANTHROPIC_API_KEY`, `OPENWEATHERMAP_APIKEY`, `ICAL_URLS`, `HOME_LAT`, `HOME_LNG`, `INKY_DEVICE_TOKEN`, `INKY_NOTES_TOKEN`, and the Upstash `KV_REST_API_URL`/`KV_REST_API_TOKEN`. Optional: `GOOGLE_MAPS_API_KEY` + `HOME_ADDRESS` (travel), `ICAL_OWNER_EMAILS`, `HOME_PLACE`, `PLANTS_FIRST_DUE`.

`ICAL_URLS` takes each Google calendar's *Secret address in iCal format* (Settings → the calendar → Integrate calendar), comma-separated, each optionally prefixed `work|` or `personal|`. Personal events are drawn solid and work events outlined.

## Files

- `time.mjs`: timezone and phase helpers
- `plants.mjs`: watering logic
- `state.mjs`: Upstash or file store
- `data/`: calendar (iCal + recurrence expansion), weather (OWM → hourly), sun (local), travel (Routes API), fixtures
- `day.mjs`: gathers one moment's facts
- `directions.mjs`: the 5 directions as deterministic skeletons (fallback + examples)
- `compose.mjs`: Sonnet → skeleton (structured output)
- `sanitize.mjs`: free-canvas SVG allowlist
- `fill.mjs`: skeleton + facts → screen
- `render.mjs`: screen → HTML → Chromium → 7-ink PNG
- `screen.mjs`: the pipeline with caching and fit-to-box
- `routes.mjs`: HTTP
