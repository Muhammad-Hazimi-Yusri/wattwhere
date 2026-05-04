/**
 * Shared colour palettes for map overlays and legend.
 *
 * - Voltages: 3-class diverging RdBu (ColorBrewer) — readable on a dark base.
 * - Plant sources: Okabe-Ito categorical — colourblind-safe.
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
  other: '#666666',
};

export const SUBSTATION_COLOUR = '#888888';
