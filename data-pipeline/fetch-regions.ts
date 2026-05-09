/**
 * Fetch GB DNO Licence Area polygons from NESO, reproject from
 * EPSG:27700 (OSGB) to EPSG:4326 (WGS84), simplify, tag each feature
 * with the carbon-intensity API's `regionid` (1–14), and write out
 * public/data/gb-regions.geojson.
 *
 * Run locally:    npm run data:regions
 * Run in CI:      .github/workflows/deploy.yml — "Populate GB regions
 *                 if seed is empty" step (mirrors the OSM pattern).
 *
 * Source dataset (NESO Open Licence, ~OGL v3.0):
 *   https://www.neso.energy/data-portal/gis-boundaries-gb-dno-license-areas
 *
 * Attribution: "Boundaries © National Energy System Operator (NESO),
 * derived from data originally shared by Western Power Distribution
 * (now National Grid Electricity Distribution)."
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';
import simplify from '@turf/simplify';

proj4.defs(
  'EPSG:27700',
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 ' +
    '+ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs',
);

const NESO_URL =
  process.env.REGIONS_URL ??
  'https://api.neso.energy/dataset/0e377f16-95e9-4c15-a1fc-49e06a39cfa0/resource/1c6a7dc0-1b6c-443a-bc67-5f7125649434/download/gb-dno-license-areas-20240503-as-geojson.geojson';

const SIMPLIFY_TOLERANCE_DEG = Number(process.env.REGIONS_TOLERANCE ?? '0.01');

// LongName (NESO file) → regionid (api.carbonintensity.org.uk).
// Multiple aliases per id cover historical/legal name variants.
const LONGNAME_TO_REGIONID: Record<string, number> = {
  'Scottish Hydro Electric Power Distribution': 1,
  'SP Distribution': 2,
  'Electricity North West': 3,
  'Northern Powergrid Northeast': 4,
  'Northern Powergrid (Northeast)': 4,
  'NPg North East': 4,
  'Northern Powergrid Yorkshire': 5,
  'Northern Powergrid (Yorkshire)': 5,
  'NPg Yorkshire': 5,
  'SP Manweb': 6,
  'National Grid Electricity Distribution South Wales': 7,
  'Western Power Distribution South Wales': 7,
  'WPD South Wales': 7,
  'National Grid Electricity Distribution West Midlands': 8,
  'Western Power Distribution West Midlands': 8,
  'WPD West Midlands': 8,
  'National Grid Electricity Distribution East Midlands': 9,
  'Western Power Distribution East Midlands': 9,
  'WPD East Midlands': 9,
  'Eastern Power Networks': 10,
  'UK Power Networks Eastern': 10,
  'National Grid Electricity Distribution South West': 11,
  'Western Power Distribution South West': 11,
  'WPD South West': 11,
  'Southern Electric Power Distribution': 12,
  'Scottish and Southern Electricity Networks Southern': 12,
  'SSEN SEPD': 12,
  'London Power Networks': 13,
  'UK Power Networks London': 13,
  'South Eastern Power Networks': 14,
  'UK Power Networks South Eastern': 14,
};

interface Feature {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

interface Collection {
  type: 'FeatureCollection';
  features: Feature[];
}

type Coord = [number, number];

function reprojectCoord(c: Coord): Coord {
  const [lon, lat] = proj4('EPSG:27700', 'EPSG:4326', c);
  return [round5(lon), round5(lat)];
}

function reproject(coords: unknown): unknown {
  if (!Array.isArray(coords)) return coords;
  if (coords.length > 0 && typeof coords[0] === 'number') {
    return reprojectCoord(coords as Coord);
  }
  return coords.map(reproject);
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

function findLongName(props: Record<string, unknown>): string | null {
  for (const key of ['LongName', 'longname', 'long_name', 'Name', 'name']) {
    const v = props[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

async function main(): Promise<void> {
  console.log(`fetching ${NESO_URL}`);
  const res = await fetch(NESO_URL, {
    headers: {
      Accept: 'application/geo+json,application/json',
      'User-Agent':
        'wattwhere/0.0.1 (+https://github.com/Muhammad-Hazimi-Yusri/wattwhere)',
    },
  });
  if (!res.ok) {
    throw new Error(`NESO HTTP ${res.status}: ${await res.text()}`);
  }
  const raw = (await res.json()) as Collection;
  if (raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
    throw new Error('NESO response is not a FeatureCollection');
  }
  console.log(`features in source: ${raw.features.length}`);

  const seen: Record<number, string> = {};
  const unmatched: string[] = [];
  const out: Feature[] = [];

  for (const f of raw.features) {
    const longName = findLongName(f.properties);
    if (!longName) {
      unmatched.push('<no name field>');
      continue;
    }
    const regionid = LONGNAME_TO_REGIONID[longName];
    if (regionid === undefined) {
      unmatched.push(longName);
      continue;
    }
    seen[regionid] = longName;
    const reprojected: Feature = {
      type: 'Feature',
      geometry: {
        type: f.geometry.type,
        coordinates: reproject(f.geometry.coordinates),
      },
      properties: { regionid, longname: longName },
    };
    const simplified = simplify(reprojected as never, {
      tolerance: SIMPLIFY_TOLERANCE_DEG,
      highQuality: false,
    }) as Feature;
    out.push(simplified);
  }

  const missing: number[] = [];
  for (let id = 1; id <= 14; id++) {
    if (!(id in seen)) missing.push(id);
  }

  if (unmatched.length > 0) {
    console.warn(`unmatched LongNames (${unmatched.length}):`);
    for (const n of unmatched) console.warn(`  - ${n}`);
  }
  if (missing.length > 0) {
    console.error(`missing regionids: ${missing.join(', ')}`);
    console.error(
      'Update LONGNAME_TO_REGIONID in data-pipeline/fetch-regions.ts.',
    );
    process.exit(1);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const target = join(here, '..', 'public', 'data', 'gb-regions.geojson');
  mkdirSync(dirname(target), { recursive: true });
  const collection: Collection = { type: 'FeatureCollection', features: out };
  writeFileSync(target, JSON.stringify(collection) + '\n');
  console.log(`wrote ${out.length} regions to ${target}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
