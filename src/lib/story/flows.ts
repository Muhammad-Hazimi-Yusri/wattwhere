/**
 * Hardcoded representative power flows for the deck.gl TripsLayer on /.
 *
 * v0 SLC: no live API. Five illustrative source→destination pairs that
 * pair with the narrative steps (Scottish wind south, North-Sea wind to
 * London, north-west nuclear corridor, north-Wales corridor, French
 * interconnector landfall). The narrative copy frames these as
 * representative, not measured.
 */
import { PLANT_SOURCE_COLOURS } from '../style/palette';

export type FuelKind = 'wind' | 'nuclear' | 'gas' | 'interconnector';

export interface Flow {
  readonly id: string;
  readonly sourceName: string;
  readonly source: readonly [number, number]; // [lon, lat]
  readonly targetName: string;
  readonly target: readonly [number, number];
  readonly fuelKind: FuelKind;
  readonly colour: string;
}

const INTERCONNECTOR_COLOUR = '#9b9b9b';

export const FLOWS: Readonly<Record<string, Flow>> = {
  'scot-wind-to-london': {
    id: 'scot-wind-to-london',
    sourceName: 'Whitelee + Clyde wind cluster',
    source: [-4.27, 55.69],
    targetName: 'Greater London',
    target: [-0.1, 51.5],
    fuelKind: 'wind',
    colour: PLANT_SOURCE_COLOURS.wind!,
  },
  'dogger-to-london': {
    id: 'dogger-to-london',
    sourceName: 'Dogger Bank offshore wind',
    source: [1.95, 54.85],
    targetName: 'Greater London',
    target: [-0.1, 51.5],
    fuelKind: 'wind',
    colour: PLANT_SOURCE_COLOURS.wind!,
  },
  'heysham-to-manchester': {
    id: 'heysham-to-manchester',
    sourceName: 'Heysham nuclear',
    source: [-2.91, 54.03],
    targetName: 'Manchester',
    target: [-2.24, 53.48],
    fuelKind: 'nuclear',
    colour: PLANT_SOURCE_COLOURS.nuclear!,
  },
  'wylfa-to-midlands': {
    id: 'wylfa-to-midlands',
    sourceName: 'North Wales corridor',
    source: [-4.48, 53.42],
    targetName: 'West Midlands',
    target: [-1.9, 52.48],
    fuelKind: 'nuclear',
    colour: PLANT_SOURCE_COLOURS.nuclear!,
  },
  'ifa-to-south-coast': {
    id: 'ifa-to-south-coast',
    sourceName: 'IFA interconnector (France)',
    source: [1.13, 50.93],
    targetName: 'Sellindge (south coast)',
    target: [0.98, 51.1],
    fuelKind: 'interconnector',
    colour: INTERCONNECTOR_COLOUR,
  },
};

export type FlowId = keyof typeof FLOWS;

/**
 * Great-circle interpolation between source and target, returning N
 * waypoints each tagged with a normalised timestamp in [0, 1]. The
 * timestamps are what TripsLayer animates against — keep them strictly
 * monotonic. Spherical linear interpolation (slerp) at GB scale is
 * visually indistinguishable from rhumb but reads as "curved", which is
 * what the visualisation wants.
 */
export function flowGreatCircle(
  flow: Flow,
  n: number = 32,
): ReadonlyArray<readonly [number, number, number]> {
  if (n < 2) throw new Error('flowGreatCircle: need at least 2 points');
  const [lon1, lat1] = flow.source;
  const [lon2, lat2] = flow.target;
  const a = lonLatToVec3(lon1, lat1);
  const b = lonLatToVec3(lon2, lat2);
  const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);
  const out: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let lon: number;
    let lat: number;
    if (sinOmega < 1e-6) {
      lon = lerp(lon1, lon2, t);
      lat = lerp(lat1, lat2, t);
    } else {
      const s1 = Math.sin((1 - t) * omega) / sinOmega;
      const s2 = Math.sin(t * omega) / sinOmega;
      const x = s1 * a[0] + s2 * b[0];
      const y = s1 * a[1] + s2 * b[1];
      const z = s1 * a[2] + s2 * b[2];
      ({ lon, lat } = vec3ToLonLat(x, y, z));
    }
    out.push([lon, lat, t]);
  }
  return out;
}

function lonLatToVec3(lon: number, lat: number): [number, number, number] {
  const lonR = (lon * Math.PI) / 180;
  const latR = (lat * Math.PI) / 180;
  return [Math.cos(latR) * Math.cos(lonR), Math.cos(latR) * Math.sin(lonR), Math.sin(latR)];
}

function vec3ToLonLat(x: number, y: number, z: number): { lon: number; lat: number } {
  const lat = (Math.asin(z) * 180) / Math.PI;
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  return { lon, lat };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
