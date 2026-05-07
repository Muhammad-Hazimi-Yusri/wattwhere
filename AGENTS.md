# AGENTS.md — wattwhere project rules

Read this file at the start of every session. These rules are load-bearing.

## Scope: Simple, Lovable, Complete (SLC)

v0 ships a single, lovable, complete explainer of the **GB** electricity grid and
market. Do not add Malaysia, Europe, or other regions in v0 — they will arrive
as separate scrolly storylines later. Do not add features, refactors, or
abstractions beyond what the current commit requires.

## Hard constraints

1. **100% static output.** No serverless functions. No backend. The site must
   `npm run build` to a `dist/` folder of pure HTML/JS/CSS that GitHub Pages
   can serve as-is. If it cannot be a single zip uploaded to a CDN, it is wrong.
2. **No API keys, ever, in v0.** Use only keyless, CORS-friendly public APIs:
   - `api.carbonintensity.org.uk` — national + regional carbon intensity
     (gCO₂/kWh), 30-min granularity, CC-BY 4.0.
   - `data.elexon.co.uk/bmrs/api/v1` — BMRS Insights Solution API
     (`/datasets/FUELINST`, `/balancing/settlement/system-prices/...`,
     `/datasets/BOALF`). Attribution: "Contains BMRS data © Elexon Limited
     copyright and database right [year]".
   - `api.octopus.energy/v1/products/AGILE-FLEX-22-11-25/...` — half-hourly
     Agile prices per GSP region.
3. **Base-path discipline.** `astro.config.mjs` reads `BASE_PATH` from env,
   defaulting to `/wattwhere`. Use `import.meta.env.BASE_URL` for every internal
   link, asset, and fetch — never hardcode `/`.
4. **No AGPL dependencies.** MIT/Apache/BSD/ISC only. Do not vendor
   `electricitymaps-contrib` frontend code.
5. **No `localStorage`/`sessionStorage` in embedded sandboxed components.**
   React state only inside islands. Top-level Astro pages can use storage.
6. **Mobile-first.** Bottom-sheet detail panels with snap points on mobile,
   side panels on desktop. Test at 375 px width.
7. **TypeScript strict everywhere.**
8. **File size <300 LoC.** Components do one thing. Split if approaching
   the limit.
9. **Every external API call goes through `src/lib/api/*`** with a typed
   client and a Vitest test using a recorded fixture. No `fetch` calls in
   components.

## Working style

- Each commit must `npm run build` cleanly before being pushed.
- After each commit, summarise in one sentence what changed and what to verify
  on the live site.
- If a CORS error or missing OSM tag appears, ask before working around it —
  there is usually a documented quirk in the source rather than a bug to patch.
- Do not generate fake data when a real API call fails. Show a skeleton plus a
  "data unavailable" state with retry. Honesty is part of the educational pitch.
- Keep refresh logic in TypeScript so it runs in the same `actions/setup-node`
  CI environment as the build. One language, one toolchain.

## Attribution requirements

Footer must always credit:

- Map © OpenStreetMap contributors (ODbL).
- Basemap © Protomaps.
- BMRS data © Elexon Limited [current year].
- Carbon Intensity © National Grid ESO (CC-BY 4.0).

## Things you will be tempted to do but should not

- Don't add ENTSO-E. It needs an API key, which means a serverless proxy,
  which kills the static-only constraint.
- Don't use `react-map-gl`. Use MapLibre directly with thin React wrappers.
- Don't try to source Whitelee's exact live MW from a single endpoint. If the
  BMRS readings look implausibly low, show "modelled estimate" with a
  methodology disclosure.
