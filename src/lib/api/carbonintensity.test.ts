import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  REGIONAL_ENDPOINT,
  fetchRegional,
  parseRegionalResponse,
} from './carbonintensity';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, '__fixtures__', 'carbon-intensity-regional.json'), 'utf8'),
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
