import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CARBON_FILL_LAYER_ID, buildStyle } from './style';
import {
  CARBON_INTENSITY_COLOURS,
  CARBON_INTENSITY_UNAVAILABLE_COLOUR,
} from '../../lib/style/palette';
import {
  fetchRegional,
  type RegionalSnapshot,
} from '../../lib/api/carbonintensity';

function normaliseBaseUrl(): string {
  return import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

function formatPeriod(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export interface BasemapProps {
  /** Absolute URL to the power infra GeoJSON. Defaults to `${BASE_URL}data/gb-power.geojson`. */
  dataUrl?: string;
  /** Absolute URL to the DNO regions GeoJSON. Defaults to `${BASE_URL}data/gb-regions.geojson`. */
  regionsUrl?: string;
  /** Initial centre [lon, lat]. Defaults to GB centre. */
  center?: [number, number];
  /** Initial zoom. */
  zoom?: number;
}

export default function Basemap({
  dataUrl,
  regionsUrl,
  center = [-2.5, 54.5],
  zoom = 5.5,
}: BasemapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RegionalSnapshot | null>(null);
  const [carbonError, setCarbonError] = useState<string | null>(null);
  const [carbonAttempt, setCarbonAttempt] = useState(0);
  // Primitives in deps: the [-2.5, 54.5] default reallocates each render.
  const [initialLon, initialLat] = center;

  useEffect(() => {
    if (!containerRef.current) return;

    const baseUrl = normaliseBaseUrl();
    const data = dataUrl ?? `${baseUrl}data/gb-power.geojson`;
    const regions = regionsUrl ?? `${baseUrl}data/gb-regions.geojson`;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(data, regions),
      center: [initialLon, initialLat],
      zoom,
      minZoom: 4,
      maxZoom: 14,
      attributionControl: { compact: true },
      hash: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', (e) => {
      const msg = e.error?.message ?? 'map error';
      setError(msg);
      console.warn('[basemap]', msg);
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [dataUrl, regionsUrl, initialLon, initialLat, zoom]);

  useEffect(() => {
    const ctrl = new AbortController();
    setCarbonError(null);
    fetchRegional({ signal: ctrl.signal })
      .then((s) => {
        if (!ctrl.signal.aborted) setSnapshot(s);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        setCarbonError(msg);
        console.warn('[basemap] carbon intensity fetch failed', msg);
      });
    return () => ctrl.abort();
  }, [carbonAttempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !snapshot) return;
    const apply = (): void => {
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
        console.warn('[basemap] cannot apply carbon paint', e);
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [snapshot]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      <div
        role="status"
        className="pointer-events-auto absolute bottom-4 left-4 max-w-sm rounded-md bg-black/80 px-3 py-2 text-xs text-white shadow ring-1 ring-white/10"
      >
        {snapshot ? (
          <span>
            Carbon intensity · as of {formatPeriod(snapshot.from)}
          </span>
        ) : carbonError ? (
          <span>
            Carbon data unavailable.{' '}
            <button
              type="button"
              onClick={() => setCarbonAttempt((n) => n + 1)}
              className="underline underline-offset-2 hover:text-white/80"
            >
              Retry
            </button>
          </span>
        ) : (
          <span>Loading carbon intensity…</span>
        )}
      </div>
      {error && (
        <div
          role="status"
          className="absolute bottom-16 left-4 max-w-sm rounded-md bg-black/80 px-3 py-2 text-xs text-white shadow"
        >
          Map data unavailable. See <code>data-pipeline/</code> scripts.
        </div>
      )}
    </div>
  );
}
