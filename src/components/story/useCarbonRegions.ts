import { useEffect, type RefObject } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import { CARBON_FILL_LAYER_ID } from '../map/style';
import {
  CARBON_INTENSITY_COLOURS,
  CARBON_INTENSITY_UNAVAILABLE_COLOUR,
} from '../../lib/style/palette';
import {
  fetchRegional,
  type RegionalSnapshot,
} from '../../lib/api/carbonintensity';

/**
 * Fetch the current regional carbon-intensity snapshot once and paint the
 * `gb-carbon-region-fill` layer with the per-region colour expression.
 *
 * Mirrors the pattern from `src/components/map/Basemap.tsx` (lines 95–131)
 * but standalone so StoryMap stays a thin wiring component. No
 * auto-refresh; the snapshot updates infrequently and the scrolly page
 * does not advertise live colour as a feature.
 */
export function useCarbonRegions(mapRef: RefObject<MlMap | null>): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ctrl = new AbortController();
    let cancelled = false;

    fetchRegional({ signal: ctrl.signal })
      .then((snapshot) => {
        if (cancelled || ctrl.signal.aborted) return;
        const apply = (): void => paintRegions(map, snapshot);
        if (map.isStyleLoaded()) apply();
        else map.once('load', apply);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[story-map] carbon intensity fetch failed', msg);
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [mapRef]);
}

function paintRegions(map: MlMap, snapshot: RegionalSnapshot): void {
  const expr: (string | number | unknown[])[] = [
    'match',
    ['get', 'regionid'],
  ];
  for (const r of snapshot.regions.values()) {
    expr.push(r.regionid, CARBON_INTENSITY_COLOURS[r.index]);
  }
  expr.push(CARBON_INTENSITY_UNAVAILABLE_COLOUR);
  try {
    map.setPaintProperty(CARBON_FILL_LAYER_ID, 'fill-color', expr as never);
  } catch (e) {
    console.warn('[story-map] cannot apply carbon paint', e);
  }
}
