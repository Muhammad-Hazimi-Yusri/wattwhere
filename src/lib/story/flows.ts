/**
 * The single "follow one electron" flow for the deck.gl TripsLayer on /.
 *
 * v0 SLC: no live API. One illustrative end-to-end journey — Dogger Bank
 * offshore wind comes ashore at the Creyke Beck substation, runs south
 * down the 400 kV transmission spine, and steps down through London's
 * distribution network to a home. The path bends at the real landfall
 * point rather than cutting a straight line; that kink is the story.
 * The narrative copy frames it as representative, not measured.
 */
import { PLANT_SOURCE_COLOURS } from '../style/palette';

export type FuelKind = 'wind';

export interface Flow {
  readonly id: string;
  readonly sourceName: string;
  readonly source: readonly [number, number]; // [lon, lat]
  readonly targetName: string;
  readonly target: readonly [number, number];
  /**
   * Optional intermediate stops between source and target, in order.
   * Used to trace the real grid hierarchy (generation → transmission
   * landfall → grid supply point → demand) instead of a single arc.
   */
  readonly waypoints?: ReadonlyArray<readonly [number, number]>;
  readonly fuelKind: FuelKind;
  readonly colour: string;
}

export const FLOWS: Readonly<Record<string, Flow>> = {
  'dogger-journey': {
    id: 'dogger-journey',
    sourceName: 'Dogger Bank A offshore wind',
    source: [1.96, 54.76], // the rendered Dogger Bank A plant dot
    targetName: 'a London home',
    target: [-0.12, 51.505], // lands on real inner-London substations
    waypoints: [
      [-0.416, 53.801], // Creyke Beck substation — Dogger Bank landfall
      [-0.78, 52.65], // East Midlands 400 kV corridor
      [-0.25, 51.75], // London approach
      [-0.06, 51.59], // grid supply point on London's edge
    ],
    fuelKind: 'wind',
    colour: PLANT_SOURCE_COLOURS.wind!,
  },
};

export type FlowId = keyof typeof FLOWS;

/**
 * Build the full animated path for a flow: source → waypoints → target,
 * great-circling each consecutive leg and stitching them into one
 * polyline with monotonic timestamps in [0, 1]. Trips animate against
 * those timestamps. Flows with no waypoints are a single leg, identical
 * to the previous straight great-circle behaviour.
 */
export function flowPath(
  flow: Flow,
  perLeg: number = 18,
): ReadonlyArray<readonly [number, number, number]> {
  if (perLeg < 2) throw new Error('flowPath: need at least 2 points per leg');
  const stops: Array<readonly [number, number]> = [
    flow.source,
    ...(flow.waypoints ?? []),
    flow.target,
  ];
  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const leg = greatCircleLeg(stops[i]!, stops[i + 1]!, perLeg);
    // Drop the first point of every leg after the first so shared
    // endpoints aren't duplicated.
    for (let j = i === 0 ? 0 : 1; j < leg.length; j++) pts.push(leg[j]!);
  }
  const n = pts.length;
  return pts.map(([lon, lat], i) => [lon, lat, i / (n - 1)] as const);
}

/**
 * Great-circle interpolation between source and target (ignores
 * waypoints), returning N points each tagged with a normalised
 * timestamp in [0, 1]. Kept for the single-leg case and tests.
 */
export function flowGreatCircle(
  flow: Flow,
  n: number = 32,
): ReadonlyArray<readonly [number, number, number]> {
  if (n < 2) throw new Error('flowGreatCircle: need at least 2 points');
  const leg = greatCircleLeg(flow.source, flow.target, n);
  return leg.map(([lon, lat], i) => [lon, lat, i / (n - 1)] as const);
}

/** Spherical-linear-interpolated points along one leg (no timestamps). */
function greatCircleLeg(
  from: readonly [number, number],
  to: readonly [number, number],
  n: number,
): ReadonlyArray<readonly [number, number]> {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const a = lonLatToVec3(lon1, lat1);
  const b = lonLatToVec3(lon2, lat2);
  const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);
  const out: Array<readonly [number, number]> = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    if (sinOmega < 1e-6) {
      out.push([lerp(lon1, lon2, t), lerp(lat1, lat2, t)]);
    } else {
      const s1 = Math.sin((1 - t) * omega) / sinOmega;
      const s2 = Math.sin(t * omega) / sinOmega;
      const x = s1 * a[0] + s2 * b[0];
      const y = s1 * a[1] + s2 * b[1];
      const z = s1 * a[2] + s2 * b[2];
      const { lon, lat } = vec3ToLonLat(x, y, z);
      out.push([lon, lat]);
    }
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
