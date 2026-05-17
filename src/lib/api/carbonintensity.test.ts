import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  NATIONAL_ENDPOINT,
  REGIONAL_ENDPOINT,
  fetchNational24h,
  fetchRegional,
  floorHalfHourUTC,
  formatApiInstant,
  national24hUrl,
  parseNationalSeries,
  parseRegionalResponse,
} from './carbonintensity';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, '__fixtures__', 'carbon-intensity-regional.json'), 'utf8'),
);
const nationalFixture = JSON.parse(
  readFileSync(join(here, '__fixtures__', 'carbon-intensity-national-24h.json'), 'utf8'),
);

describe('parseRegionalResponse', () => {
  it('parses all 14 DNO regions and keys them by regionid', () => {
    const snapshot = parseRegionalResponse(fixture);
    expect(snapshot.from).toBe('2026-05-09T16:30Z');
    expect(snapshot.regions.size).toBe(14);
    for (let id = 1; id <= 14; id++) {
      expect(snapshot.regions.has(id)).toBe(true);
    }
  });

  it('captures forecast value and 5-tier index', () => {
    const snapshot = parseRegionalResponse(fixture);
    const london = snapshot.regions.get(13);
    expect(london).toBeDefined();
    expect(london?.shortname).toBe('London');
    expect(london?.forecast).toBe(248);
    expect(london?.index).toBe('very high');
    expect(snapshot.regions.get(1)?.index).toBe('very low');
  });

  it('skips malformed regions instead of throwing', () => {
    const snapshot = parseRegionalResponse({
      data: [
        {
          from: 'a',
          to: 'b',
          regions: [
            { regionid: 1, dnoregion: 'x', shortname: 'y', intensity: { forecast: 100, index: 'low' } },
            { regionid: 'oops' },
            { regionid: 2, dnoregion: 'x', shortname: 'y', intensity: { forecast: 100, index: 'unknown' } },
          ],
        },
      ],
    });
    expect(snapshot.regions.size).toBe(1);
    expect(snapshot.regions.get(1)).toBeDefined();
  });

  it('throws on empty data array', () => {
    expect(() => parseRegionalResponse({ data: [] })).toThrow(/empty/);
  });
});

describe('fetchRegional', () => {
  it('hits the documented regional endpoint with Accept: application/json', async () => {
    let calledUrl = '';
    let calledHeaders: Record<string, string> = {};
    const fakeFetch = async (url: string, init?: RequestInit) => {
      calledUrl = url;
      calledHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify(fixture), { status: 200 });
    };
    const snapshot = await fetchRegional({ fetchImpl: fakeFetch });
    expect(calledUrl).toBe(REGIONAL_ENDPOINT);
    expect(calledHeaders.Accept).toBe('application/json');
    expect(snapshot.regions.size).toBe(14);
  });

  it('throws on non-2xx', async () => {
    const fakeFetch = async () => new Response('nope', { status: 503 });
    await expect(fetchRegional({ fetchImpl: fakeFetch })).rejects.toThrow(/503/);
  });
});

describe('floorHalfHourUTC + formatApiInstant + national24hUrl', () => {
  it('floors any instant to the previous half-hour boundary in UTC', () => {
    expect(floorHalfHourUTC(new Date('2026-05-17T12:17:30.500Z')).toISOString())
      .toBe('2026-05-17T12:00:00.000Z');
    expect(floorHalfHourUTC(new Date('2026-05-17T12:45:00.000Z')).toISOString())
      .toBe('2026-05-17T12:30:00.000Z');
    expect(floorHalfHourUTC(new Date('2026-05-17T12:30:00.000Z')).toISOString())
      .toBe('2026-05-17T12:30:00.000Z');
  });

  it('formats an instant as YYYY-MM-DDThh:mmZ (no seconds)', () => {
    expect(formatApiInstant(new Date('2026-05-17T09:05:00.000Z')))
      .toBe('2026-05-17T09:05Z');
  });

  it('builds a 24h-window URL anchored to the floored "now"', () => {
    const url = national24hUrl(new Date('2026-05-17T12:45:00.000Z'));
    expect(url).toBe(`${NATIONAL_ENDPOINT}/2026-05-16T12:30Z/2026-05-17T12:30Z`);
  });
});

describe('parseNationalSeries', () => {
  it('parses every half-hour slot in the fixture', () => {
    const series = parseNationalSeries(nationalFixture);
    expect(series.points).toHaveLength(48);
    expect(series.from).toBe(series.points[0]!.from);
    expect(series.to).toBe(series.points[series.points.length - 1]!.to);
  });

  it('captures forecast, actual, and 5-tier index per point', () => {
    const series = parseNationalSeries(nationalFixture);
    const first = series.points[0]!;
    expect(first.forecast).toBe(185);
    expect(first.actual).toBe(188);
    expect(first.index).toBe('moderate');
  });

  it('represents missing actual readings as null (forecast-only slots)', () => {
    const series = parseNationalSeries(nationalFixture);
    const forecastOnly = series.points.filter((p) => p.actual === null);
    expect(forecastOnly.length).toBeGreaterThan(0);
    for (const p of forecastOnly) {
      expect(typeof p.forecast).toBe('number');
    }
  });

  it('skips malformed periods instead of throwing', () => {
    const series = parseNationalSeries({
      data: [
        { from: 'a', to: 'b', intensity: { forecast: 100, index: 'low' } },
        { from: 'c', to: 'd', intensity: { forecast: 'x', index: 'low' } },
        { from: 'e', to: 'f', intensity: { forecast: 90, index: 'unknown' } },
        { from: 'g', to: 'h', intensity: { forecast: 80, actual: 75, index: 'very low' } },
      ],
    });
    expect(series.points).toHaveLength(2);
    expect(series.points[0]!.forecast).toBe(100);
    expect(series.points[1]!.actual).toBe(75);
  });

  it('throws when data array is empty or yields no valid points', () => {
    expect(() => parseNationalSeries({ data: [] })).toThrow(/empty/);
    expect(() =>
      parseNationalSeries({
        data: [{ from: 1, to: 2, intensity: { forecast: 1, index: 'low' } }],
      }),
    ).toThrow(/no valid points/);
  });
});

describe('fetchNational24h', () => {
  it('hits NATIONAL_ENDPOINT with a 24h window URL and Accept JSON header', async () => {
    let calledUrl = '';
    let calledHeaders: Record<string, string> = {};
    const fakeFetch = async (url: string, init?: RequestInit) => {
      calledUrl = url;
      calledHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify(nationalFixture), { status: 200 });
    };
    const series = await fetchNational24h({
      fetchImpl: fakeFetch,
      now: new Date('2026-05-17T17:15:00.000Z'),
    });
    expect(calledUrl).toBe(`${NATIONAL_ENDPOINT}/2026-05-16T17:00Z/2026-05-17T17:00Z`);
    expect(calledHeaders.Accept).toBe('application/json');
    expect(series.points).toHaveLength(48);
  });

  it('throws on non-2xx', async () => {
    const fakeFetch = async () => new Response('down', { status: 502 });
    await expect(fetchNational24h({ fetchImpl: fakeFetch })).rejects.toThrow(/502/);
  });
});
