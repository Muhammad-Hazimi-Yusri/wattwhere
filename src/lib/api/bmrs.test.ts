import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  BMRS_FUELINST_ENDPOINT,
  FUEL_TYPES,
  fetchFuelInst24h,
  fuelInst24hUrl,
  parseFuelInstResponse,
} from './bmrs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, '__fixtures__', 'bmrs-fuelinst-24h.json'), 'utf8'),
);

describe('fuelInst24hUrl', () => {
  it('builds a 24h-window URL anchored to the floored "now"', () => {
    const url = fuelInst24hUrl(new Date('2026-05-19T06:17:30.000Z'));
    expect(url).toContain(BMRS_FUELINST_ENDPOINT);
    expect(url).toContain('publishDateTimeFrom=2026-05-18T06%3A00Z');
    expect(url).toContain('publishDateTimeTo=2026-05-19T06%3A00Z');
    expect(url).toContain('format=json');
  });
});

describe('parseFuelInstResponse', () => {
  it('pivots 5-min rows into timestamped points with fuel maps', () => {
    const series = parseFuelInstResponse(fixture);
    expect(series.points.length).toBeGreaterThan(200); // ~288 expected
    expect(series.from).toBe(series.points[0]!.time);
    expect(series.to).toBe(series.points[series.points.length - 1]!.time);
    for (const p of series.points) {
      expect(Object.keys(p.fuels).length).toBeGreaterThan(0);
      for (const [fuel, mw] of Object.entries(p.fuels)) {
        expect(FUEL_TYPES).toContain(fuel as never);
        expect(mw).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('collapses INT* codes into a single INTERCONNECTOR bucket', () => {
    const series = parseFuelInstResponse({
      data: [
        { startTime: 't', fuelType: 'INTFR',  generation: 500 },
        { startTime: 't', fuelType: 'INTNED', generation: 300 },
        { startTime: 't', fuelType: 'INTNSL', generation: 100 },
        { startTime: 't', fuelType: 'CCGT',   generation: 9000 },
      ],
    });
    expect(series.points).toHaveLength(1);
    expect(series.points[0]!.fuels.INTERCONNECTOR).toBe(900);
    expect(series.points[0]!.fuels.CCGT).toBe(9000);
  });

  it('drops unknown fuels and malformed rows', () => {
    const series = parseFuelInstResponse({
      data: [
        { startTime: 't', fuelType: 'CCGT',   generation: 100 },
        { startTime: 't', fuelType: 'UNKNOWN_X', generation: 999 },
        { fuelType: 'CCGT', generation: 50 }, // missing startTime
        { startTime: 't', fuelType: 'WIND',   generation: 'NaN' as never },
        { startTime: 't', fuelType: 'WIND',   generation: 200 },
      ],
    });
    expect(series.points).toHaveLength(1);
    expect(series.points[0]!.fuels.CCGT).toBe(100);
    expect(series.points[0]!.fuels.WIND).toBe(200);
    expect((series.points[0]!.fuels as Record<string, unknown>).UNKNOWN_X).toBeUndefined();
  });

  it('accepts a bare-array payload as well as { data: [...] }', () => {
    const bare = parseFuelInstResponse([
      { startTime: 't', fuelType: 'CCGT', generation: 10 },
    ]);
    expect(bare.points).toHaveLength(1);
    expect(bare.points[0]!.fuels.CCGT).toBe(10);
  });

  it('throws on empty response', () => {
    expect(() => parseFuelInstResponse({ data: [] })).toThrow(/empty/);
    expect(() => parseFuelInstResponse([])).toThrow(/empty/);
  });

  it('throws when nothing parseable remains', () => {
    expect(() =>
      parseFuelInstResponse({
        data: [{ startTime: 1, fuelType: 'CCGT', generation: 10 }],
      }),
    ).toThrow(/no parseable/);
  });
});

describe('fetchFuelInst24h', () => {
  it('hits BMRS_FUELINST_ENDPOINT with the 24h window URL and Accept JSON', async () => {
    let calledUrl = '';
    let calledHeaders: Record<string, string> = {};
    const fakeFetch = async (url: string, init?: RequestInit) => {
      calledUrl = url;
      calledHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify(fixture), { status: 200 });
    };
    const series = await fetchFuelInst24h({
      fetchImpl: fakeFetch,
      now: new Date('2026-05-19T06:00:00.000Z'),
    });
    expect(calledUrl).toContain(BMRS_FUELINST_ENDPOINT);
    expect(calledUrl).toContain('publishDateTimeFrom=2026-05-18T06%3A00Z');
    expect(calledHeaders.Accept).toBe('application/json');
    expect(series.points.length).toBeGreaterThan(200);
  });

  it('throws on non-2xx', async () => {
    const fakeFetch = async () => new Response('down', { status: 502 });
    await expect(fetchFuelInst24h({ fetchImpl: fakeFetch })).rejects.toThrow(/502/);
  });
});
