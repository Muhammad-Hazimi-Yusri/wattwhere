import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MlMap, type StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { layers, namedTheme } from 'protomaps-themes-base';
import 'maplibre-gl/dist/maplibre-gl.css';

let pmtilesProtocolRegistered = false;
function registerPmtilesProtocol(): void {
  if (pmtilesProtocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesProtocolRegistered = true;
}

function buildStyle(tilesUrl: string): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/dark',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${tilesUrl}`,
        attribution:
          '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>, © <a href="https://protomaps.com">Protomaps</a>',
      },
    },
    layers: layers('protomaps', namedTheme('dark'), { lang: 'en' }),
  };
}

export interface BasemapProps {
  /** Absolute URL to the PMTiles archive. Defaults to `${BASE_URL}tiles/gb.pmtiles`. */
  tilesUrl?: string;
  /** Initial centre [lon, lat]. Defaults to GB centre. */
  center?: [number, number];
  /** Initial zoom. */
  zoom?: number;
}

export default function Basemap({
  tilesUrl,
  center = [-2.5, 54.5],
  zoom = 5.5,
}: BasemapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    registerPmtilesProtocol();

    const baseUrl = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    const resolved = tilesUrl ?? `${window.location.origin}${baseUrl}tiles/gb.pmtiles`;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(resolved),
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
      // Surface to console for debugging without throwing.
      console.warn('[basemap]', msg);
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [tilesUrl, center, zoom]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      {error && (
        <div
          role="status"
          className="absolute bottom-4 left-4 max-w-sm rounded-md bg-black/80 px-3 py-2 text-xs text-white shadow"
        >
          Basemap data unavailable. Tile extract may be missing — see
          {' '}
          <code>data-pipeline/extract-pmtiles.sh</code>.
        </div>
      )}
    </div>
  );
}
