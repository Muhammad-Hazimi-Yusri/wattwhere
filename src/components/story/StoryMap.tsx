import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildStyle } from '../map/style';
import {
  MAPLIBRE_MAX_ZOOM,
  MAPLIBRE_MIN_ZOOM,
  OVERLAY_LAYER_IDS,
  OVERLAY_SETS,
  STEPS,
  STEP_ORDER,
  onStoryStep,
  type Step,
} from '../../lib/story/steps';

function normaliseBaseUrl(): string {
  return import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

export interface StoryMapProps {
  /** Absolute URL to the power infra GeoJSON. Defaults to `${BASE_URL}data/gb-power.geojson`. */
  dataUrl?: string;
  /** Absolute URL to the DNO regions GeoJSON. Defaults to `${BASE_URL}data/gb-regions.geojson`. */
  regionsUrl?: string;
}

export default function StoryMap({
  dataUrl,
  regionsUrl,
}: StoryMapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const first = STEPS[STEP_ORDER[0]!]!;
    const baseUrl = normaliseBaseUrl();
    const data = dataUrl ?? `${baseUrl}data/gb-power.geojson`;
    const regions = regionsUrl ?? `${baseUrl}data/gb-regions.geojson`;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(data, regions),
      center: first.center as [number, number],
      zoom: first.zoom,
      minZoom: MAPLIBRE_MIN_ZOOM,
      maxZoom: MAPLIBRE_MAX_ZOOM,
      attributionControl: { compact: true },
      hash: false,
      // The story map is scroll-driven; pan/zoom would fight the next flyTo.
      interactive: false,
    });
    // Same first-paint fix as Basemap: <astro-island> uses display: contents,
    // so clientHeight can read as 0 on the first measurement.
    const resizeRaf = requestAnimationFrame(() => map.resize());

    function applyVisibility(step: Step): void {
      const active = new Set<string>();
      for (const set of step.overlays) {
        for (const id of OVERLAY_LAYER_IDS[set]) active.add(id);
      }
      for (const set of OVERLAY_SETS) {
        for (const id of OVERLAY_LAYER_IDS[set]) {
          try {
            map.setLayoutProperty(
              id,
              'visibility',
              active.has(id) ? 'visible' : 'none',
            );
          } catch (e) {
            console.warn('[story-map] cannot set visibility', id, e);
          }
        }
      }
    }

    function applyStep(step: Step): void {
      map.flyTo({
        center: step.center as [number, number],
        zoom: step.zoom,
        pitch: step.pitch ?? 0,
        bearing: step.bearing ?? 0,
        // Deliberate: in a scrollytelling page the camera move IS the
        // content. Honouring prefers-reduced-motion here would lose the
        // spatial continuity the narrative is trying to teach.
        essential: true,
      });
      if (map.isStyleLoaded()) applyVisibility(step);
      else map.once('idle', () => applyVisibility(step));
    }

    map.once('load', () => applyVisibility(first));
    const unsubscribe = onStoryStep(({ step }) => applyStep(step));

    map.on('error', (e) => {
      console.warn('[story-map]', e.error?.message ?? 'map error');
    });
    mapRef.current = map;

    return () => {
      unsubscribe();
      cancelAnimationFrame(resizeRaf);
      map.remove();
      mapRef.current = null;
    };
  }, [dataUrl, regionsUrl]);

  // Size the container with viewport-derived classes that mirror the
  // parent <aside>. We can't rely on `h-full` (broken through Astro's
  // <astro-island> display: contents — see commit e72e960 on Basemap)
  // nor on `absolute inset-0` (MapLibre forces .maplibregl-map to
  // position: relative once it mounts, defeating any Tailwind `absolute`
  // class). Explicit viewport units bypass both traps.
  return (
    <div
      ref={containerRef}
      className="h-[60vh] w-full md:h-[calc(100vh-2rem)]"
    />
  );
}
