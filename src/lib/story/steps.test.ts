import { describe, expect, it } from 'vitest';
import { buildStyle } from '../../components/map/style';
import {
  GB_LAT_BOUNDS,
  GB_LON_BOUNDS,
  MAPLIBRE_MAX_ZOOM,
  MAPLIBRE_MIN_ZOOM,
  OVERLAY_LAYER_IDS,
  OVERLAY_SETS,
  STEPS,
  STEP_ORDER,
  STORY_STEP_EVENT,
  dispatchStep,
  onStoryStep,
  type Step,
} from './steps';

describe('STEPS config', () => {
  it('STEP_ORDER is in 1:1 correspondence with STEPS keys', () => {
    expect([...STEP_ORDER].sort()).toEqual([...Object.keys(STEPS)].sort());
    for (const id of STEP_ORDER) {
      expect(STEPS[id]?.id).toBe(id);
    }
  });

  it('every step.overlays entry is a known OverlaySet', () => {
    const known = new Set(OVERLAY_SETS);
    for (const step of Object.values(STEPS)) {
      for (const o of step.overlays) {
        expect(known.has(o)).toBe(true);
      }
    }
  });

  it('every zoom is within MapLibre bounds', () => {
    for (const step of Object.values(STEPS)) {
      expect(step.zoom).toBeGreaterThanOrEqual(MAPLIBRE_MIN_ZOOM);
      expect(step.zoom).toBeLessThanOrEqual(MAPLIBRE_MAX_ZOOM);
    }
  });

  it('every centre is inside GB bounds (guards against [lat, lon] swap)', () => {
    for (const step of Object.values(STEPS)) {
      const [lon, lat] = step.center;
      expect(lon).toBeGreaterThanOrEqual(GB_LON_BOUNDS[0]);
      expect(lon).toBeLessThanOrEqual(GB_LON_BOUNDS[1]);
      expect(lat).toBeGreaterThanOrEqual(GB_LAT_BOUNDS[0]);
      expect(lat).toBeLessThanOrEqual(GB_LAT_BOUNDS[1]);
    }
  });
});

describe('OVERLAY_LAYER_IDS', () => {
  it('every referenced layer ID exists in buildStyle()', () => {
    const style = buildStyle('x://power', 'x://regions');
    const styleIds = new Set(style.layers.map((l) => l.id));
    for (const set of OVERLAY_SETS) {
      for (const id of OVERLAY_LAYER_IDS[set]) {
        expect(styleIds.has(id)).toBe(true);
      }
    }
  });

  it('basemap and labels are NOT in any overlay set (they are always-on)', () => {
    const allOverlayIds = new Set<string>();
    for (const set of OVERLAY_SETS) {
      for (const id of OVERLAY_LAYER_IDS[set]) allOverlayIds.add(id);
    }
    expect(allOverlayIds.has('carto-base')).toBe(false);
    expect(allOverlayIds.has('carto-labels')).toBe(false);
  });
});

describe('dispatchStep / onStoryStep', () => {
  it('round-trips a step through the window event bus', () => {
    const received: Step[] = [];
    const unsubscribe = onStoryStep(({ step }) => received.push(step));
    const step = STEPS.intro!;
    dispatchStep(step);
    dispatchStep(STEPS.plants!);
    unsubscribe();
    dispatchStep(STEPS.regions!); // should not be received after unsubscribe
    expect(received.map((s) => s.id)).toEqual(['intro', 'plants']);
    expect(received[0]).toBe(step);
  });

  it('uses the documented event name', () => {
    expect(STORY_STEP_EVENT).toBe('wattwhere:story-step');
  });
});
