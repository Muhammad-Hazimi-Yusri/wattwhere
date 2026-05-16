/**
 * Fetch GB power infrastructure from OpenStreetMap via the Overpass API and
 * write it as GeoJSON to public/data/gb-power.geojson.
 *
 * Run locally:    npm run data:osm
 * Run in CI:      .github/workflows/refresh-data.yml (monthly cron)
 *
 * The bbox covers Great Britain plus Northern Ireland and the Channel Islands.
 *
 * OSM data is licensed ODbL 1.0. Attribution: © OpenStreetMap contributors.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface OsmTags {
  [k: string]: string | undefined;
}
interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: OsmTags;
}
interface OsmWay {
  type: 'way';
  id: number;
  nodes?: number[];
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: OsmTags;
}
interface OsmRelation {
  type: 'relation';
  id: number;
  members?: Array<{
    type: string;
    ref: number;
    role: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
  tags?: OsmTags;
}
type OsmElement = OsmNode | OsmWay | OsmRelation;

interface OsmResponse {
  version: number;
  generator: string;
  elements: OsmElement[];
}

const BBOX = '49.5,-8.7,61.1,2.1';
const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';

const QUERY = `[out:json][timeout:300];
(
  way["power"="line"]["voltage"](${BBOX});
  way["power"="cable"]["voltage"](${BBOX});
  node["power"="substation"](${BBOX});
  way["power"="substation"](${BBOX});
  relation["power"="substation"](${BBOX});
  way["power"="plant"](${BBOX});
  relation["power"="plant"](${BBOX});
);
out body geom;`;

async function fetchOverpass(): Promise<OsmResponse> {
  const body = new URLSearchParams({ data: QUERY }).toString();
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'wattwhere/0.0.1 (+https://github.com/Muhammad-Hazimi-Yusri/wattwhere)',
      },
      body,
    });
    if (res.ok) return (await res.json()) as OsmResponse;
    if (res.status === 429 || res.status === 504 || res.status >= 500) {
      const wait = 1000 * 2 ** attempt;
      console.warn(`overpass HTTP ${res.status}; retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`overpass HTTP ${res.status}: ${await res.text()}`);
  }
  throw new Error('overpass: max retries exceeded');
}

function highestVoltage(value: string | undefined): number | null {
  if (!value) return null;
  const parts = value
    .split(/[;,]/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  if (parts.length === 0) return null;
  return Math.max(...parts);
}

function bucketVoltage(v: number | null): 132 | 275 | 400 | null {
  if (v === null) return null;
  if (v >= 380000) return 400;
  if (v >= 250000) return 275;
  if (v >= 130000) return 132;
  return null;
}

const PLANT_SOURCE_MAP: Record<string, string> = {
  wind: 'wind',
  solar: 'solar',
  hydro: 'hydro',
  nuclear: 'nuclear',
  gas: 'gas',
  natural_gas: 'gas',
  coal: 'coal',
  oil: 'oil',
  diesel: 'oil',
  biomass: 'biomass',
  biofuel: 'biomass',
  waste: 'biomass',
  battery: 'battery',
};

function normaliseSource(s: string | undefined): string {
  if (!s) return 'other';
  const first = s.split(/[;,]/)[0]?.trim().toLowerCase() ?? '';
  return PLANT_SOURCE_MAP[first] ?? 'other';
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

function centroid(coords: Array<[number, number]>): [number, number] {
  if (coords.length === 0) return [0, 0];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of coords) {
    sx += x;
    sy += y;
  }
  return [round5(sx / coords.length), round5(sy / coords.length)];
}

interface Feature {
  type: 'Feature';
  geometry:
    | { type: 'Point'; coordinates: [number, number] }
    | { type: 'LineString'; coordinates: [number, number][] };
  properties: Record<string, string | number | undefined>;
}

function lineFeature(way: OsmWay): Feature | null {
  const v = bucketVoltage(highestVoltage(way.tags?.voltage));
  if (v === null) return null;
  if (!way.geometry || way.geometry.length < 2) return null;
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: way.geometry.map((p) => [round5(p.lon), round5(p.lat)] as [number, number]),
    },
    properties: {
      kind: 'line',
      voltage: v,
      name: way.tags?.name,
      operator: way.tags?.operator,
    },
  };
}

function elementCoords(el: OsmWay | OsmRelation): Array<[number, number]> {
  if (el.type === 'way') {
    return (el.geometry ?? []).map((p) => [p.lon, p.lat] as [number, number]);
  }
  const out: Array<[number, number]> = [];
  for (const m of el.members ?? []) {
    if (m.geometry) {
      for (const p of m.geometry) out.push([p.lon, p.lat]);
    }
  }
  return out;
}

function substationFeature(el: OsmElement): Feature | null {
  if (el.type === 'node') {
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [round5(el.lon), round5(el.lat)] },
      properties: {
        kind: 'substation',
        name: el.tags?.name,
        voltage: highestVoltage(el.tags?.voltage) ?? undefined,
      },
    };
  }
  const coords = elementCoords(el);
  if (coords.length === 0) return null;
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: centroid(coords) },
    properties: {
      kind: 'substation',
      name: el.tags?.name,
      voltage: highestVoltage(el.tags?.voltage) ?? undefined,
    },
  };
}

function plantFeature(el: OsmElement): Feature | null {
  if (el.type === 'node') return null;
  const coords = elementCoords(el);
  if (coords.length === 0) return null;
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: centroid(coords) },
    properties: {
      kind: 'plant',
      source: normaliseSource(el.tags?.['plant:source']),
      name: el.tags?.name,
      operator: el.tags?.operator,
      capacity: el.tags?.['plant:output:electricity'],
    },
  };
}

function osmToGeoJSON(osm: OsmResponse): {
  type: 'FeatureCollection';
  features: Feature[];
  metadata: Record<string, string>;
} {
  const features: Feature[] = [];
  let lines = 0;
  let subs = 0;
  let plants = 0;
  for (const el of osm.elements) {
    const power = el.tags?.power;
    if (power === 'line' || power === 'cable') {
      if (el.type !== 'way') continue;
      const f = lineFeature(el);
      if (f) {
        features.push(f);
        lines++;
      }
    } else if (power === 'substation') {
      const f = substationFeature(el);
      if (f) {
        features.push(f);
        subs++;
      }
    } else if (power === 'plant') {
      const f = plantFeature(el);
      if (f) {
        features.push(f);
        plants++;
      }
    }
  }
  console.log(
    `features: ${lines} lines, ${subs} substations, ${plants} plants (total ${features.length})`,
  );
  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      source: 'OpenStreetMap via Overpass API',
      licence: 'ODbL 1.0',
      attribution: '© OpenStreetMap contributors',
      generated: new Date().toISOString(),
      bbox: BBOX,
    },
  };
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, '..', 'public', 'data', 'gb-power.geojson');
  console.log(`fetching from ${OVERPASS_URL}...`);
  const osm = await fetchOverpass();
  console.log(`elements: ${osm.elements.length}`);
  const geo = osmToGeoJSON(osm);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(geo) + '\n');
  console.log(`wrote ${out}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
