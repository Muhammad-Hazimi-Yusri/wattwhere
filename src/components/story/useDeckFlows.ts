import { useEffect, useRef, type RefObject } from 'react';
import type { Map as MlMap, IControl as MlIControl } from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { TripsLayer } from '@deck.gl/geo-layers';
import { FLOWS, flowGreatCircle, type Flow } from '../../lib/story/flows';

const TRIP_PERIOD_MS = 6_000;
const TRAIL_LENGTH = 0.25;

interface TripDatum {
  readonly id: string;
  readonly path: ReadonlyArray<readonly [number, number]>;
  readonly timestamps: ReadonlyArray<number>;
  readonly colour: readonly [number, number, number];
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [255, 255, 255];
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

function expandFlow(flow: Flow): TripDatum {
  const samples = flowGreatCircle(flow);
  return {
    id: flow.id,
    path: samples.map(([lon, lat]) => [lon, lat] as const),
    timestamps: samples.map(([, , t]) => t),
    colour: hexToRgb(flow.colour),
  };
}

/**
 * Animate the active flow IDs as TripsLayer trips over the MapLibre map.
 *
 * Pattern: single MapboxOverlay attached as a MapLibre IControl on
 * 'load'; one rAF loop drives currentTime in [0, 1] with period
 * TRIP_PERIOD_MS. Under prefers-reduced-motion the loop holds at 0.5 so
 * trips render as static arcs.
 */
export function useDeckFlows(
  mapRef: RefObject<MlMap | null>,
  activeFlowIds: ReadonlyArray<string>,
): void {
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef<number>(0);
  const activeRef = useRef<ReadonlyArray<string>>([]);

  activeRef.current = activeFlowIds;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const reduced = prefersReducedMotion();

    const attach = (): void => {
      if (overlayRef.current) return;
      const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
      // deck.gl's IControl type uses Mapbox's brand; structurally identical
      // to MapLibre's. Cast at the boundary.
      map.addControl(overlay as unknown as MlIControl);
      overlayRef.current = overlay;
    };

    if (map.isStyleLoaded()) attach();
    else map.once('load', attach);

    t0Ref.current = performance.now();

    const tick = (now: number): void => {
      const overlay = overlayRef.current;
      if (overlay) {
        const t = reduced
          ? 0.5
          : ((now - t0Ref.current) % TRIP_PERIOD_MS) / TRIP_PERIOD_MS;
        const data: TripDatum[] = [];
        for (const id of activeRef.current) {
          const flow = FLOWS[id];
          if (flow) data.push(expandFlow(flow));
        }
        const layer = new TripsLayer<TripDatum>({
          id: 'wattwhere-flows',
          data,
          getPath: (d: TripDatum) => d.path as Array<[number, number]>,
          getTimestamps: (d: TripDatum) => d.timestamps as number[],
          getColor: (d: TripDatum) => d.colour as [number, number, number],
          getWidth: 3,
          widthUnits: 'pixels',
          fadeTrail: true,
          trailLength: TRAIL_LENGTH,
          currentTime: t,
          opacity: data.length ? 1 : 0,
          // Interleave above carbon/power overlays but below labels.
          // `beforeId` is a documented MapboxOverlay-interleaved prop
          // but missing from deck.gl 9.x's TripsLayer prop type; spread
          // at the boundary to bypass the strict prop type.
          ...({ beforeId: 'carto-labels' } as object),
        });
        overlay.setProps({ layers: [layer] });
      }
      if (!reduced) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const overlay = overlayRef.current;
      const m = mapRef.current;
      if (overlay && m) {
        try {
          m.removeControl(overlay as unknown as MlIControl);
        } catch (e) {
          console.warn('[deck-flows] removeControl', e);
        }
      }
      overlayRef.current = null;
    };
  }, [mapRef]);
}
