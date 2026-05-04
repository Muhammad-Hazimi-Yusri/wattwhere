# wattwhere

A static, scrolly + dashboard explainer of the GB electricity grid and market.

**Live site:** https://chronohax.github.io/wattwhere/

Status: scaffolding (v0 in progress).

## Stack

- [Astro 5](https://astro.build) (static output) with MDX, React, Tailwind.
- [MapLibre GL JS](https://maplibre.org) + [Protomaps PMTiles](https://protomaps.com)
  for the basemap (no Mapbox token).
- [deck.gl](https://deck.gl) for animated arc/trip layers.
- [Observable Plot](https://observablehq.com/plot) for time series, d3-sankey
  for the bill-flow diagram, [Scrollama](https://github.com/russellgoldenberg/scrollama)
  for scroll triggers.
- TypeScript strict everywhere.

## Local development

```bash
npm install
npm run dev      # http://localhost:4321/wattwhere/
npm run build    # outputs to dist/
npm run preview  # serves the production build locally
```

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds with
`BASE_PATH=/wattwhere` and publishes `dist/` to GitHub Pages.

## Project rules

See [`AGENTS.md`](./AGENTS.md) — read it before each session.

## Licence

MIT — see [`LICENSE`](./LICENSE).

## Attribution

- Map © OpenStreetMap contributors (ODbL).
- Basemap © Protomaps.
- BMRS data © Elexon Limited.
- Carbon Intensity © National Grid ESO (CC-BY 4.0).
