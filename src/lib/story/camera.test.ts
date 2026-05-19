import { describe, expect, it } from 'vitest';
import { lerpCamera, type CameraState } from './camera';

const A: CameraState = { center: [-2.5, 54.5], zoom: 5.5, pitch: 0, bearing: 0 };
const B: CameraState = { center: [-0.1, 51.5], zoom: 9, pitch: 10, bearing: 90 };

describe('lerpCamera', () => {
  it('returns a at t = 0', () => {
    const r = lerpCamera(A, B, 0);
    expect(r).toEqual(A);
  });

  it('returns b at t = 1', () => {
    const r = lerpCamera(A, B, 1);
    expect(r).toEqual(B);
  });

  it('midpoints each field at t = 0.5', () => {
    const r = lerpCamera(A, B, 0.5);
    expect(r.center[0]).toBeCloseTo((-2.5 + -0.1) / 2);
    expect(r.center[1]).toBeCloseTo((54.5 + 51.5) / 2);
    expect(r.zoom).toBeCloseTo((5.5 + 9) / 2);
    expect(r.pitch).toBeCloseTo(5);
    expect(r.bearing).toBeCloseTo(45);
  });

  it('clamps t below 0', () => {
    expect(lerpCamera(A, B, -0.5)).toEqual(A);
  });

  it('clamps t above 1', () => {
    expect(lerpCamera(A, B, 2)).toEqual(B);
  });

  it('applies smoothstep easing — early progress is slower than linear', () => {
    // smoothstep(0.25) = 0.15625 → camera dwells nearer A at the start.
    const r = lerpCamera(A, B, 0.25);
    const linearZoom = A.zoom + (B.zoom - A.zoom) * 0.25;
    expect(r.zoom).toBeLessThan(linearZoom);
  });

  it('applies smoothstep easing — late progress overshoots linear', () => {
    // smoothstep(0.75) = 0.84375 → camera hurries toward B near the end.
    const r = lerpCamera(A, B, 0.75);
    const linearZoom = A.zoom + (B.zoom - A.zoom) * 0.75;
    expect(r.zoom).toBeGreaterThan(linearZoom);
  });
});
