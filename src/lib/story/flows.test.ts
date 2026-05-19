import { describe, expect, it } from 'vitest';
import { GB_LAT_BOUNDS, GB_LON_BOUNDS, STEPS } from './steps';
import { FLOWS, flowGreatCircle } from './flows';

describe('FLOWS config', () => {
  it('flow IDs are unique and match the FLOWS keys', () => {
    for (const [key, flow] of Object.entries(FLOWS)) {
      expect(flow.id).toBe(key);
    }
  });

  it('every flow source and target sits inside GB bounds', () => {
    for (const flow of Object.values(FLOWS)) {
      for (const [lon, lat] of [flow.source, flow.target]) {
        expect(lon).toBeGreaterThanOrEqual(GB_LON_BOUNDS[0]);
        expect(lon).toBeLessThanOrEqual(GB_LON_BOUNDS[1]);
        expect(lat).toBeGreaterThanOrEqual(GB_LAT_BOUNDS[0]);
        expect(lat).toBeLessThanOrEqual(GB_LAT_BOUNDS[1]);
      }
    }
  });

  it('every flow has a non-empty colour hex', () => {
    for (const flow of Object.values(FLOWS)) {
      expect(flow.colour).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('STEPS.flows', () => {
  it('every step.flows entry references a known FLOWS key', () => {
    for (const step of Object.values(STEPS)) {
      for (const id of step.flows ?? []) {
        expect(FLOWS[id]).toBeDefined();
      }
    }
  });
});

describe('flowGreatCircle', () => {
  const flow = FLOWS['scot-wind-to-london']!;

  it('returns N points with timestamps strictly monotonic in [0, 1]', () => {
    const samples = flowGreatCircle(flow, 16);
    expect(samples).toHaveLength(16);
    expect(samples[0]![2]).toBe(0);
    expect(samples[15]![2]).toBe(1);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]![2]).toBeGreaterThan(samples[i - 1]![2]);
    }
  });

  it('the first and last points equal the source and target', () => {
    const samples = flowGreatCircle(flow, 8);
    const [lon0, lat0] = samples[0]!;
    const [lonN, latN] = samples[samples.length - 1]!;
    expect(lon0).toBeCloseTo(flow.source[0], 4);
    expect(lat0).toBeCloseTo(flow.source[1], 4);
    expect(lonN).toBeCloseTo(flow.target[0], 4);
    expect(latN).toBeCloseTo(flow.target[1], 4);
  });

  it('throws when N < 2', () => {
    expect(() => flowGreatCircle(flow, 1)).toThrow();
  });
});
