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

interface Fetchable {
  (input: string, init?: RequestInit): Promise<Response>;
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
