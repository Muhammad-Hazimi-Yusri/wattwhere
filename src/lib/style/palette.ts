/**
 * Shared colour palettes for map overlays and legend.
 *
 * - Voltages: 3-class diverging RdBu (ColorBrewer) — readable on a dark base.
 * - Plant sources: Okabe-Ito categorical — colourblind-safe.
 * - Carbon intensity: 5-class sequential green→red, keyed to the National
 *   Grid Carbon Intensity API's own `intensity.index` buckets.
 */

export const VOLTAGE_COLOURS = {
  132: '#67a9cf',
  275: '#f7f7f7',
  400: '#ef8a62',
} as const;

export type VoltageBucket = keyof typeof VOLTAGE_COLOURS;

export const PLANT_SOURCE_COLOURS: Record<string, string> = {
  wind: '#56B4E9',
  solar: '#F0E442',
  hydro: '#0072B2',
  nuclear: '#CC79A7',
  gas: '#E69F00',
  coal: '#000000',
  oil: '#D55E00',
  biomass: '#009E73',
  battery: '#999999',
  interconnector: '#9b9b9b',
  other: '#666666',
};

export const SUBSTATION_COLOUR = '#888888';

/**
 * Maps each BMRS-collapsed FuelType to a colour from PLANT_SOURCE_COLOURS.
 * Same Okabe-Ito categorical palette; offshore and pumped-storage delegate
 * to their nearest equivalents to keep the stacked-area chart readable.
 */
export const FUEL_COLOURS: Record<string, string> = {
  CCGT: PLANT_SOURCE_COLOURS.gas!,
  OCGT: PLANT_SOURCE_COLOURS.gas!,
  COAL: PLANT_SOURCE_COLOURS.coal!,
  OIL: PLANT_SOURCE_COLOURS.oil!,
  NUCLEAR: PLANT_SOURCE_COLOURS.nuclear!,
  BIOMASS: PLANT_SOURCE_COLOURS.biomass!,
  WIND: PLANT_SOURCE_COLOURS.wind!,
  OFFSHORE_WIND: PLANT_SOURCE_COLOURS.wind!,
  SOLAR: PLANT_SOURCE_COLOURS.solar!,
  HYDRO: PLANT_SOURCE_COLOURS.hydro!,
  PUMP_STORAGE: PLANT_SOURCE_COLOURS.hydro!,
  INTERCONNECTOR: PLANT_SOURCE_COLOURS.interconnector!,
  OTHER: PLANT_SOURCE_COLOURS.other!,
};

export const CARBON_INTENSITY_INDEXES = [
  'very low',
  'low',
  'moderate',
  'high',
  'very high',
] as const;

export type CarbonIntensityIndex = (typeof CARBON_INTENSITY_INDEXES)[number];

export const CARBON_INTENSITY_COLOURS: Record<CarbonIntensityIndex, string> = {
  'very low': '#1a9850',
  low: '#91cf60',
  moderate: '#fee08b',
  high: '#fc8d59',
  'very high': '#d73027',
};

export const CARBON_INTENSITY_UNAVAILABLE_COLOUR = '#3a3a3a';
