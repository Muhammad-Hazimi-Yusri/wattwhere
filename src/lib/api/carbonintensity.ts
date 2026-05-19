/**
 * National Grid Carbon Intensity API client.
 *
 * https://carbon-intensity.github.io/api-definitions/
 * Data: gCO₂/kWh per DNO region, half-hourly. CC-BY 4.0.
 *
 * AGENTS.md: every external API call lives in src/lib/api/* with a typed
 * client and a Vitest fixture. Components must not call fetch directly.
 */
import {
  CARBON_INTENSITY_INDEXES,
  type CarbonIntensityIndex,
} from '../style/palette';

export const REGIONAL_ENDPOINT = 'https://api.carbonintensity.org.uk/regional';
export const NATIONAL_ENDPOINT = 'https://api.carbonintensity.org.uk/intensity';

export interface RegionalReading {
  regionid: number;
  dnoregion: string;
  shortname: string;
  forecast: number;
  index: CarbonIntensityIndex;
}

export interface RegionalSnapshot {
  from: string;
  to: string;
  regions: Map<number, RegionalReading>;
}

export interface NationalPoint {
  from: string;
  to: string;
  forecast: number;
  actual: number | null;
  index: CarbonIntensityIndex;
}

export interface NationalSeries {
  from: string;
  to: string;
  points: NationalPoint[];
}

interface Fetchable {
  (input: string, init?: RequestInit): Promise<Response>;
}

// Time helpers lifted to src/lib/time.ts (shared with bmrs.ts).
// Re-exported here so existing imports keep working unchanged.
export { floorHalfHourUTC, formatApiInstant } from '../time';
import { floorHalfHourUTC, formatApiInstant } from '../time';

export function national24hUrl(now: Date = new Date()): string {
  const end = floorHalfHourUTC(now);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return `${NATIONAL_ENDPOINT}/${formatApiInstant(start)}/${formatApiInstant(end)}`;
}

export async function fetchRegional(opts?: {
  fetchImpl?: Fetchable;
  signal?: AbortSignal;
}): Promise<RegionalSnapshot> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const res = await fetchImpl(REGIONAL_ENDPOINT, {
    headers: { Accept: 'application/json' },
    signal: opts?.signal,
  });
  if (!res.ok) throw new Error(`carbon intensity HTTP ${res.status}`);
  return parseRegionalResponse(await res.json());
}

const INDEX_SET = new Set<string>(CARBON_INTENSITY_INDEXES);

function isIndex(s: unknown): s is CarbonIntensityIndex {
  return typeof s === 'string' && INDEX_SET.has(s);
}

export function parseRegionalResponse(payload: unknown): RegionalSnapshot {
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('carbon intensity: empty data array');
  }
  const period = data[0] as {
    from?: unknown;
    to?: unknown;
    regions?: unknown;
  };
  if (typeof period.from !== 'string' || typeof period.to !== 'string') {
    throw new Error('carbon intensity: missing from/to');
  }
  if (!Array.isArray(period.regions)) {
    throw new Error('carbon intensity: regions not an array');
  }
  const regions = new Map<number, RegionalReading>();
  for (const r of period.regions) {
    const region = r as {
      regionid?: unknown;
      dnoregion?: unknown;
      shortname?: unknown;
      intensity?: { forecast?: unknown; index?: unknown };
    };
    if (
      typeof region.regionid !== 'number' ||
      typeof region.dnoregion !== 'string' ||
      typeof region.shortname !== 'string' ||
      typeof region.intensity?.forecast !== 'number' ||
      !isIndex(region.intensity.index)
    ) {
      continue;
    }
    regions.set(region.regionid, {
      regionid: region.regionid,
      dnoregion: region.dnoregion,
      shortname: region.shortname,
      forecast: region.intensity.forecast,
      index: region.intensity.index,
    });
  }
  return { from: period.from, to: period.to, regions };
}

export async function fetchNational24h(opts?: {
  fetchImpl?: Fetchable;
  signal?: AbortSignal;
  now?: Date;
}): Promise<NationalSeries> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const url = national24hUrl(opts?.now);
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: opts?.signal,
  });
  if (!res.ok) throw new Error(`carbon intensity HTTP ${res.status}`);
  return parseNationalSeries(await res.json());
}

export function parseNationalSeries(payload: unknown): NationalSeries {
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('carbon intensity: empty data array');
  }
  const points: NationalPoint[] = [];
  for (const raw of data) {
    const p = raw as {
      from?: unknown;
      to?: unknown;
      intensity?: { forecast?: unknown; actual?: unknown; index?: unknown };
    };
    if (
      typeof p.from !== 'string' ||
      typeof p.to !== 'string' ||
      typeof p.intensity?.forecast !== 'number' ||
      !isIndex(p.intensity.index)
    ) {
      continue;
    }
    const actual = typeof p.intensity.actual === 'number' ? p.intensity.actual : null;
    points.push({
      from: p.from,
      to: p.to,
      forecast: p.intensity.forecast,
      actual,
      index: p.intensity.index,
    });
  }
  if (points.length === 0) {
    throw new Error('carbon intensity: no valid points');
  }
  return {
    from: points[0]!.from,
    to: points[points.length - 1]!.to,
    points,
  };
}
