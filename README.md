# 🎃 SafeTreat

A Halloween safety web app:

- **Report** unsafe candy or incidents at a house, party or street corner. No account needed.
- **Plan** a trick-or-treat route that avoids reported danger zones and suits your child's allergies, using houses registered by their owners.
- **Record** the route you actually walked, and get **warned later** if unsafe candy is reported anywhere along it.
- **Homeowners** list the treats they hand out and which allergens they avoid, and upload a photo of their ID, which Gemma reads, to earn a gold "ID checked" badge.
- **Local news** along a planned route is checked for recent crashes, crimes and other dangers.

**Gemma** does the language and vision work. It grades each report (category, severity 1–5, one-line summary, spam check), cross-checks homeowners' "allergen-free" claims against their candy list, writes the calm, practical alert parents receive, decides which local news stories matter for a route, and reads homeowners' ID photos. Every Gemma step has a keyword/template fallback, so the app works offline, and nothing a user is waiting on blocks on the model.

## Designs

SafeTreat ships four interchangeable designs. Switch with the palette menu in the nav, or compare them side by side at **`/designs`**:

| Design | Feel | Built from ([OpenDesign](https://github.com/nexu-io/open-design)) |
|---|---|---|
| **Nightfall** (default) | precise near-black, one pumpkin accent | `linear-app` |
| **Porchlight** | warm paper, Fraunces serif, terracotta | `warm-editorial` |
| **Candy Shop** | neobrutalist ink outlines, hard shadows | `neobrutalism` |
| **Pixel Patrol** | handheld-tracker bezel, pixel type, CRT scanlines (inspired by spideytracker.net) | `retro` + `dithered` |

Each lives in `design-systems/<id>/` as an OpenDesign package (`manifest.json`, `DESIGN.md`, `tokens.css`). Components only read semantic tokens, so adding a fifth design is a new folder plus one entry in `src/lib/themes.ts`. See [design-systems/README.md](design-systems/README.md).

## Quick start

Needs Node.js 20+.

```bash
npm install
cp .env.example .env        # then fill in keys (all optional, see below)
npx prisma migrate deploy   # creates prisma/dev.db
npm run db:seed             # demo data: houses + 12 reports across central Brampton, ON
npm run dev                 # http://localhost:3000
```

Demo accounts (password = `DEMO_PASSWORD` from `.env`, default `trickortreat`):

| user | role | what to try |
|---|---|---|
| `demo` | parent (child has a peanut allergy) | plan a route, simulate a walk, see alerts |
| `demo-home` | homeowner | edit the house, try the allergen check, verify ID |

## Keys (all optional)

| Variable | What it enables | Without it |
|---|---|---|
| `GEMINI_API_KEY` + `GEMMA_PROVIDER=google` | Gemma via Google AI Studio (`GEMMA_MODEL`, default `gemma-4-31b-it`) | keyword triage, template alerts |
| `GEMMA_PROVIDER=ollama` | local Gemma via [Ollama](https://ollama.com) (`ollama pull gemma3`) | — |
| `ORS_API_KEY` | OpenRouteService walking directions ([free key](https://openrouteservice.org/dev/#/signup)) | street-following walking routes from OpenStreetMap via FOSSGIS Valhalla (no key), which avoids danger zones natively; FOSSGIS OSRM with detours as a backup |
| `ID_CHECK_ALLOW_SAMPLES=true` | lets ID cards marked SAMPLE/SPECIMEN pass the Gemma ID check, so demos never need a real ID | sample cards are rejected |

Hosted Gemma can take up to a minute under load, so it never sits in a user's request path:

- **New report:** posted instantly with keyword triage, and alerts go out at once. Gemma then re-grades the report in the background (`after()`), hides it if it's spam, and rewrites the alert text.
- **House save:** the allergen cross-check waits at most `GEMMA_TIMEOUT_MS` (default 15 s), then falls back to the built-in brand table.

## 2-minute demo

1. **Safety map** (`/`): seeded candy reports 🍬 and incidents ⚠️ with shaded danger zones, plus registered houses (gold ring = ID checked, teal dot = non-food treats).
2. Log in as `demo` → **Plan a route**. Tap the map to set home and press **Plan safe route** under "Suggest for me". The route follows real streets. Houses with Reese's/Snickers are faded (peanut allergy), and houses inside danger zones or with reports are skipped. Each skip comes with a reason.
3. **Save trip** → **Simulate walk** replays the route as GPS points and finishes the trip.
4. In a private window, **Report** unsafe candy at one of the houses on that route.
5. Back as `demo`, the bell badge lights up within 30 s. The alert says where and when you passed, what to look for and what to do.
6. Log in as `demo-home` → **My house**. Tick "Peanuts" as avoided while listing Reese's, and the save is blocked with a warning. Then **Check my ID**: with `ID_CHECK_ALLOW_SAMPLES=true`, press **Use the sample ID** (a card marked SAMPLE with the homeowner's own name and address) and submit.
7. Under any planned route, **Local news near this route** lists recent incidents reported on those streets (often none).

## Demo day

1. **Stop any running dev server**, then run `npm run demo`. It applies migrations, reseeds, builds and starts a production server on http://localhost:3000. Pages load instantly, with no compiling on first visit. Reseeding resets the ID check for `demo-home` and the parent's allergies (Peanuts). Seeded incidents last 48 h, so seed the same day.
2. In a second terminal, about 10 minutes before you start, run `npm run warmup`. It loads every page, plans a route (warming the routing and news caches) and times one Gemma call:
   - **Gemma responsive:** good to go.
   - **Gemma slow:** the ID check and news can take up to a minute; run the ID check early or have a screenshot ready.
   - **Gemma not answering:** reports, news and alerts fall back to keywords and templates, and the ID check says it's unavailable.
   - For an AI that can't be rate-limited, run Gemma locally: `ollama pull gemma3`, then set `GEMMA_PROVIDER="ollama"`.
3. **Internet is required** for map tiles (OpenStreetMap), routing (FOSSGIS Valhalla), news (Google News) and Gemma. Test on the venue Wi-Fi and keep a phone hotspot as backup.
4. Set `ID_CHECK_ALLOW_SAMPLES="true"` in `.env` so the ID check works with the built-in sample card.
5. Log in as `demo` and **allow browser notifications** on the Alerts page so the pop-up alert appears during the demo.
6. Use **Simulate walk** rather than real GPS. Real tracking needs HTTPS when the app is opened from a phone.
7. Pick the design first from the palette menu; `/designs` makes a good opening slide.
8. Keep `.env` off screen; it holds your Gemini key.
9. Optional: screen-record one full run (report → plan → simulate → alert → ID check) as a backup.

If pages start returning 404 or login bounces back to the form while using `npm run dev`, the dev cache is stale (usually after switching git branches with the server running). Stop the server, `rm -rf .next`, and start it again.

## How it works

- `src/lib/matching.ts`: a trip "passed" a report if any GPS point **or the segment between two points** came within 50 m, from 3 days before to 12 h after the reported time. Runs both ways: when a candy report is posted (checks all recorded tracks) and when a trip finishes (checks existing reports). `unique(tripId, reportId)` prevents duplicate alerts.
- `src/lib/dangerZones.ts`: each active report becomes a circle: candy reports cover the house and its neighbours (35–55 m), incidents cover the street (60 m at severity 1 up to 140 m at 5). New incidents expire after `INCIDENT_TTL_HOURS` (default 6 h; seeded ones last 48 h); candy reports stay.
- `src/lib/routing.ts`: with an ORS key, OpenRouteService `foot-walking` with `avoid_polygons`. Without one, the free FOSSGIS Valhalla pedestrian router routes on OpenStreetMap with the zones passed as `exclude_polygons` and driveways/alleys/service roads penalized, so kids stay on streets and sidewalks. If Valhalla is down, the FOSSGIS OSRM foot router is used per leg, retrying via detour points around any zone and keeping the route with the least exposure (depth × severity, plus distance). The planner shows a visible warning if it ever has to fall back to straight lines. Stops inside a zone are dropped and explained; straight lines are only a last resort if no router answers.
- `src/lib/houses.ts`: house suggestions are filtered by active/open hours, safety flag, danger zones, allergens (teal-pumpkin houses count as safe) and the verified-only toggle. They are then scored (verified +3, teal +1, fully wrapped +1, minus distance) and ordered as a nearest-neighbour loop.
- `src/lib/identity.ts` + `readIdDocument` in `gemma.ts`: the homeowner uploads a photo of their ID. Gemma (vision) reads the document type, name, expiry and address, and is told not to return the ID number or birth date. Plain code then decides: readable government photo ID, not a sample (unless demo mode), not expired, name matches the legal name. The image only lives in memory for that request and is never saved or logged; 5 attempts per day. This is an AI document read, not bank-grade identity verification: it can't detect forgeries or confirm the uploader is the person on the card, so the badge says "ID checked".
- `src/lib/news.ts`: for a planned route, searches Google News RSS (free, no key) for each street walked plus the city over the last 14 days, keeps stories matching danger keywords, and asks Gemma which ones are real safety risks on those streets (keyword-only "unverified" matches if Gemma is unavailable). Streets come from the router's maneuvers and the stops' addresses. Matching is by street name, so a story may be from another stretch of a long street; the card says which street matched.
- Stack: Next.js 15 (App Router), Prisma + SQLite, Leaflet + OpenStreetMap, Turf, Tailwind v4 (driven by the design-system tokens).

## Scripts

```bash
npm run dev       # dev server
npm test          # unit tests (matching, planner rules, name matching, Gemma parsing)
npm run lint
npm run build
npm run db:seed   # reset demo data
npm run demo      # reseed + production build + start on :3000
npm run warmup    # pre-demo check: pages, routing, news, Gemma latency
```

## Limits (it's a hackathon demo)

- Reports are anonymous and only filtered by Gemma's spam check; a real launch needs moderation and rate limiting.
- An ID check proves who a homeowner is, not that they live at the address.
- Candy allergen data is a rough helper (`src/lib/allergens.ts`), not medical advice. Recipes vary.
- Location tracking only runs while the trip page is open.
