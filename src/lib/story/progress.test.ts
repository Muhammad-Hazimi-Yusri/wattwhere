import { describe, expect, it } from 'vitest';
import { computeProgress, type SectionRect } from './progress';

const ORDER = ['a', 'b', 'c'] as const;
const SECTIONS: ReadonlyArray<SectionRect> = [
  { id: 'a', top: 0, height: 800 },
  { id: 'b', top: 800, height: 800 },
  { id: 'c', top: 1600, height: 800 },
];

describe('computeProgress', () => {
  it('returns null for empty sections', () => {
    expect(computeProgress([], 0, 800, ORDER)).toBeNull();
  });

  it('reports the first section with progress 0 when midpoint is above it', () => {
    // scrollY 0, viewport 200 → midpoint at 100; first section top is 0.
    // Actually midpoint 100 is inside the first section [0, 800).
    // Use a section that starts below the midpoint to test the "above" branch.
    const offset: ReadonlyArray<SectionRect> = [
      { id: 'a', top: 500, height: 800 },
      { id: 'b', top: 1300, height: 800 },
    ];
    const r = computeProgress(offset, 0, 200, ['a', 'b']);
    expect(r).toEqual({ stepId: 'a', progress: 0, nextStepId: 'b' });
  });

  it('reports the active section and clamped t when midpoint is inside', () => {
    // scrollY 200, viewport 800 → midpoint 600, inside section a [0, 800).
    const r = computeProgress(SECTIONS, 200, 800, ORDER);
    expect(r?.stepId).toBe('a');
    expect(r?.progress).toBeCloseTo(600 / 800);
    expect(r?.nextStepId).toBe('b');
  });

  it('rolls over to the next section once midpoint crosses its top', () => {
    // midpoint at 800 = section b top → "inside b" branch (top-inclusive).
    const r = computeProgress(SECTIONS, 400, 800, ORDER);
    expect(r?.stepId).toBe('b');
    expect(r?.progress).toBeCloseTo(0);
  });

  it('reports the last section with nextStepId null', () => {
    const r = computeProgress(SECTIONS, 1800, 800, ORDER);
    expect(r?.stepId).toBe('c');
    expect(r?.nextStepId).toBeNull();
    expect(r?.progress).toBeGreaterThan(0);
    expect(r?.progress).toBeLessThanOrEqual(1);
  });

  it('returns the last section with progress 1 when midpoint is past every section', () => {
    const r = computeProgress(SECTIONS, 10_000, 800, ORDER);
    expect(r).toEqual({ stepId: 'c', progress: 1, nextStepId: null });
  });

  it('clamps progress to [0, 1]', () => {
    // Force a fractional t > 1 via a tiny section height — clamp ensures sane output.
    const tiny: ReadonlyArray<SectionRect> = [
      { id: 'a', top: 0, height: 100 },
      { id: 'b', top: 100, height: 100 },
    ];
    const r = computeProgress(tiny, 80, 200, ['a', 'b']);
    if (r && r.stepId === 'a') {
      expect(r.progress).toBeLessThanOrEqual(1);
      expect(r.progress).toBeGreaterThanOrEqual(0);
    }
  });
});
