import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { layers as protomapsLayers, namedTheme } from 'protomaps-themes-base';
import {
  CARBON_INTENSITY_UNAVAILABLE_COLOUR,
  PLANT_SOURCE_COLOURS,
  SUBSTATION_COLOUR,
  VOLTAGE_COLOURS,
} from '../../lib/style/palette';

const BASEMAP_ATTRIBUTION =
  '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>, © <a href="https://protomaps.com">Protomaps</a>';
const POWER_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';
const CARBON_ATTRIBUTION =
  'Carbon © <a href="https://www.carbonintensity.org.uk/">National Grid ESO</a> CC-BY 4.0; boundaries © NESO';

export const CARBON_FILL_LAYER_ID = 'gb-carbon-region-fill';

function powerLayers(): LayerSpecification[] {
  const lines: LayerSpecification = {
    id: 'gb-power-line',
    source: 'gb-power',
    type: 'line',
    filter: ['==', ['get', 'kind'], 'line'],
    paint: {
      'line-color': [
        'match',
        ['get', 'voltage'],
        400,
        VOLTAGE_COLOURS[400],
        275,
        VOLTAGE_COLOURS[275],
        132,
        VOLTAGE_COLOURS[132],
        '#888',
      ],
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5,
        ['match', ['get', 'voltage'], 400, 0.8, 275, 0.6, 132, 0.4, 0.3],
        12,
        ['match', ['get', 'voltage'], 400, 2.4, 275, 1.8, 132, 1.2, 0.8],
      ],
      'line-opacity': 0.85,
    },
  };

  const substations: LayerSpecification = {
    id: 'gb-power-substation',
    source: 'gb-power',
    type: 'circle',
    filter: ['==', ['get', 'kind'], 'substation'],
    minzoom: 9,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 4],
      'circle-color': SUBSTATION_COLOUR,
      'circle-stroke-color': '#0a0e14',
      'circle-stroke-width': 0.5,
      'circle-opacity': 0.9,
    },
  };

  const plantColourMatch: LayerSpecification['paint'] = {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 10, 6, 14, 10],
    'circle-color': [
      'match',
      ['get', 'source'],
      'wind',
      PLANT_SOURCE_COLOURS.wind!,
      'solar',
      PLANT_SOURCE_COLOURS.solar!,
      'hydro',
      PLANT_SOURCE_COLOURS.hydro!,
      'nuclear',
      PLANT_SOURCE_COLOURS.nuclear!,
      'gas',
      PLANT_SOURCE_COLOURS.gas!,
      'coal',
      PLANT_SOURCE_COLOURS.coal!,
      'oil',
      PLANT_SOURCE_COLOURS.oil!,
      'biomass',
      PLANT_SOURCE_COLOURS.biomass!,
      'battery',
      PLANT_SOURCE_COLOURS.battery!,
      PLANT_SOURCE_COLOURS.other!,
    ],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1,
    'circle-opacity': 0.9,
  };

  const plants: LayerSpecification = {
    id: 'gb-power-plant',
    source: 'gb-power',
    type: 'circle',
    filter: ['==', ['get', 'kind'], 'plant'],
    paint: plantColourMatch,
  };

  return [lines, substations, plants];
}

function carbonRegionLayers(): LayerSpecification[] {
  const fill: LayerSpecification = {
    id: CARBON_FILL_LAYER_ID,
    source: 'gb-regions',
    type: 'fill',
    paint: {
      'fill-color': CARBON_INTENSITY_UNAVAILABLE_COLOUR,
      'fill-opacity': 0.45,
    },
  };
  const outline: LayerSpecification = {
    id: 'gb-carbon-region-outline',
    source: 'gb-regions',
    type: 'line',
    paint: {
      'line-color': '#000',
      'line-opacity': 0.45,
      'line-width': 0.6,
    },
  };
  return [fill, outline];
}

export function buildStyle(
  tilesUrl: string,
  dataUrl: string,
  regionsUrl: string,
): StyleSpecification {
  const base = protomapsLayers('protomaps', namedTheme('dark'), { lang: 'en' });
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/dark',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${tilesUrl}`,
        attribution: BASEMAP_ATTRIBUTION,
      },
      'gb-regions': {
        type: 'geojson',
        data: regionsUrl,
        attribution: CARBON_ATTRIBUTION,
      },
      'gb-power': {
        type: 'geojson',
        data: dataUrl,
        attribution: POWER_ATTRIBUTION,
      },
    },
    layers: [...base, ...carbonRegionLayers(), ...powerLayers()],
  };
}
