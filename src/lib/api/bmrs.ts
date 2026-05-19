/**
 * BMRS Insights FUELINST client (Elexon).
 *
 * Endpoint: https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELINST/stream
 * Cadence: roughly 5-minute instantaneous generation by fuel type, in MW.
 * Attribution: "Contains BMRS data © Elexon Limited copyright and database right [year]"
 *
 * AGENTS.md: every external API call lives in src/lib/api/* with a typed
 * client and a Vitest fixture. Components must not call fetch directly.
 */
import { floorHalfHourUTC, formatApiInstant } from '../time';

export const BMRS_FUELINST_ENDPOINT =
  'https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELINST/stream';

/** Collapsed fuel taxonomy used by the chart. */
export const FUEL_TYPES = [
  'CCGT',
  'OCGT',
  'COAL',
  'OIL',
  'NUCLEAR',
  'BIOMASS',
  'WIND',
  'OFFSHORE_WIND',
  'SOLAR',
  'HYDRO',
  'PUMP_STORAGE',
  'INTERCONNECTOR',
  'OTHER',
] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

/** Interconnector flavours collapsed into INTERCONNECTOR by the parser. */
const INTERCONNECTOR_CODES = new Set<string>([
  'INTFR',
  'INTIRL',
  'INTNED',
  'INTEW',
  'INTNEM',
  'INTELEC',
  'INTIFA2',
  'INTNSL',
  'INTVKL',
]);

/** Map raw fuel strings to our taxonomy. Unknown returns null. */
function normaliseFuel(raw: string): FuelType | null {
  const v = raw.trim().toUpperCase();
  if (INTERCONNECTOR_CODES.has(v)) return 'INTERCONNECTOR';
  if ((FUEL_TYPES as ReadonlyArray<string>).includes(v)) return v as FuelType;
  return null;
}

export interface FuelInstPoint {
  /** ISO start of the 5-min interval. */
  readonly time: string;
  readonly fuels: Partial<Record<FuelType, number>>;
}

export interface FuelInstSeries {
  readonly from: string;
  readonly to: string;
  readonly points: ReadonlyArray<FuelInstPoint>;
}

interface Fetchable {
  (input: string, init?: RequestInit): Promise<Response>;
}

/**
 * Build a 24h-window URL anchored to the previous half-hour boundary.
 * BMRS uses ISO datetimes with seconds, but the half-hour-boundary
 * grid is the natural sampling rate for a 24h chart.
 */
export function fuelInst24hUrl(now: Date = new Date()): string {
  const end = floorHalfHourUTC(now);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    publishDateTimeFrom: formatApiInstant(start),
    publishDateTimeTo: formatApiInstant(end),
    format: 'json',
  });
  return `${BMRS_FUELINST_ENDPOINT}?${params.toString()}`;
}

export async function fetchFuelInst24h(opts?: {
  fetchImpl?: Fetchable;
  signal?: AbortSignal;
  now?: Date;
}): Promise<FuelInstSeries> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const url = fuelInst24hUrl(opts?.now);
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: opts?.signal,
  });
  if (!res.ok) throw new Error(`BMRS FUELINST HTTP ${res.status}`);
  return parseFuelInstResponse(await res.json());
}

interface RawRow {
  startTime?: unknown;
  fuelType?: unknown;
  generation?: unknown;
}

/**
 * BMRS may return rows in either of two shapes:
 *   1. A bare JSON array `[ {...}, {...} ]`.
 *   2. An envelope `{ data: [ {...}, {...} ] }`.
 * We accept either. Unknown fuels and malformed rows are skipped; if
 * nothing remains we throw with a clear message.
 */
export function parseFuelInstResponse(payload: unknown): FuelInstSeries {
  const rows: unknown[] = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data)
      : [];
  if (rows.length === 0) {
    throw new Error('BMRS FUELINST: empty response');
  }

  // Pivot: time -> fuels map.
  const byTime = new Map<string, Partial<Record<FuelType, number>>>();
  for (const raw of rows) {
    const r = raw as RawRow;
    if (typeof r.startTime !== 'string') continue;
    if (typeof r.fuelType !== 'string') continue;
    if (typeof r.generation !== 'number' || !Number.isFinite(r.generation)) continue;
    const fuel = normaliseFuel(r.fuelType);
    if (!fuel) continue;
    let bucket = byTime.get(r.startTime);
    if (!bucket) {
      bucket = {};
      byTime.set(r.startTime, bucket);
    }
    bucket[fuel] = (bucket[fuel] ?? 0) + r.generation;
  }

  const times = [...byTime.keys()].sort();
  if (times.length === 0) {
    throw new Error('BMRS FUELINST: no parseable rows');
  }
  const points: FuelInstPoint[] = times.map((t) => ({
    time: t,
    fuels: byTime.get(t)!,
  }));
  return {
    from: points[0]!.time,
    to: points[points.length - 1]!.time,
    points,
  };
}
