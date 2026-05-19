/**
 * Pure linear interpolation between two MapLibre camera states. Driven
 * by `useStoryProgress`'s t ∈ [0, 1] and applied to the map via
 * `map.jumpTo`. No animation primitives — this is a positional fn.
 *
 * TODO: bearing wrap-around at the 0°/360° boundary. No step uses a
 * non-zero bearing today; revisit if a rotated step is added.
 */

export interface CameraState {
  readonly center: readonly [number, number];
  readonly zoom: number;
  readonly pitch: number;
  readonly bearing: number;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpCamera(a: CameraState, b: CameraState, t: number): CameraState {
  const c = clamp01(t);
  // Exact endpoints: avoids floating-point drift that would make
  // jumpTo invocations at progress=1 slightly off-target.
  if (c === 0) return { center: [a.center[0], a.center[1]], zoom: a.zoom, pitch: a.pitch, bearing: a.bearing };
  if (c === 1) return { center: [b.center[0], b.center[1]], zoom: b.zoom, pitch: b.pitch, bearing: b.bearing };
  // Hermite smoothstep. Camera dwells near each step's resting state
  // and accelerates through the middle — kills the "stuck mid-pan"
  // feeling on long transitions like plants → closer-look.
  const k = c * c * (3 - 2 * c);
  return {
    center: [lerp(a.center[0], b.center[0], k), lerp(a.center[1], b.center[1], k)],
    zoom: lerp(a.zoom, b.zoom, k),
    pitch: lerp(a.pitch, b.pitch, k),
    bearing: lerp(a.bearing, b.bearing, k),
  };
}
