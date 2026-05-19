import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildStyle } from '../map/style';
import {
  MAPLIBRE_MAX_ZOOM,
  MAPLIBRE_MIN_ZOOM,
  OVERLAY_LAYER_IDS,
  STEPS,
  STEP_ORDER,
  onStoryStep,
  type Step,
} from '../../lib/story/steps';
import {
  OVERLAY_OPACITY,
  TRANSITION_LAYER_IDS,
} from '../../lib/story/overlay-opacity';
import { useCarbonRegions } from './useCarbonRegions';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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

  useCarbonRegions(mapRef);

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

    function applyOverlayOpacities(step: Step): void {
      const active = new Set<string>();
      for (const set of step.overlays) {
        for (const id of OVERLAY_LAYER_IDS[set]) active.add(id);
      }
      for (const [id, { prop, baseline }] of Object.entries(OVERLAY_OPACITY)) {
        try {
          map.setPaintProperty(id, prop, active.has(id) ? baseline : 0);
        } catch (e) {
          console.warn('[story-map] opacity', id, e);
        }
      }
    }

    function honourReducedMotion(): void {
      // flyTo({ essential: true }) stays — camera moves are content.
      // Opacity cross-fades are decoration; snap them under reduced motion.
      if (!prefersReducedMotion()) return;
      for (const id of TRANSITION_LAYER_IDS) {
        const { prop } = OVERLAY_OPACITY[id]!;
        try {
          map.setPaintProperty(
            id,
            `${prop}-transition` as never,
            { duration: 0, delay: 0 } as never,
          );
        } catch (e) {
          console.warn('[story-map] reduced-motion transition', id, e);
        }
      }
    }

    function applyStep(step: Step): void {
      map.flyTo({
        center: step.center as [number, number],
        zoom: step.zoom,
        pitch: step.pitch ?? 0,
        bearing: step.bearing ?? 0,
        speed: 0.7,
        curve: 1.6,
        easing: (t) => t * (2 - t),
        // Deliberate: in a scrollytelling page the camera move IS the
        // content. Honouring prefers-reduced-motion here would lose the
        // spatial continuity the narrative is trying to teach.
        essential: true,
      });
      if (map.isStyleLoaded()) applyOverlayOpacities(step);
      else map.once('idle', () => applyOverlayOpacities(step));
    }

    map.once('load', () => {
      honourReducedMotion();
      applyOverlayOpacities(first);
    });
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
