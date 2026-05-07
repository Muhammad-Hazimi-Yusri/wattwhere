import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildStyle } from './style';

let pmtilesProtocolRegistered = false;
function registerPmtilesProtocol(): void {
  if (pmtilesProtocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesProtocolRegistered = true;
}

function normaliseBaseUrl(): string {
  return import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

export interface BasemapProps {
  /** Absolute URL to the PMTiles archive. Defaults to `${BASE_URL}tiles/gb.pmtiles`. */
  tilesUrl?: string;
  /** Absolute URL to the power infra GeoJSON. Defaults to `${BASE_URL}data/gb-power.geojson`. */
  dataUrl?: string;
  /** Initial centre [lon, lat]. Defaults to GB centre. */
  center?: [number, number];
  /** Initial zoom. */
  zoom?: number;
}

export default function Basemap({
  tilesUrl,
  dataUrl,
  center = [-2.5, 54.5],
  zoom = 5.5,
}: BasemapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    registerPmtilesProtocol();

    const baseUrl = normaliseBaseUrl();
    const tiles = tilesUrl ?? `${window.location.origin}${baseUrl}tiles/gb.pmtiles`;
    const data = dataUrl ?? `${baseUrl}data/gb-power.geojson`;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(tiles, data),
      center,
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
  }, [tilesUrl, dataUrl, center, zoom]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      {error && (
        <div
          role="status"
          className="absolute bottom-4 left-4 max-w-sm rounded-md bg-black/80 px-3 py-2 text-xs text-white shadow"
        >
          Map data unavailable. See <code>data-pipeline/</code> scripts.
        </div>
      )}
    </div>
  );
}
