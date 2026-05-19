/**
 * Pure helper for the continuous scroll-progress event bus. Given the
 * document-coordinate rectangle of each `[data-step]` section, the
 * current scroll position, and the viewport height, returns the active
 * step id and the t ∈ [0, 1] of how far the viewport midpoint sits
 * through that section.
 *
 * No DOM access, no time-based logic — easy to Vitest.
 */

export interface SectionRect {
  readonly id: string;
  /** Document-coordinate top of the section. */
  readonly top: number;
  readonly height: number;
}

export interface ProgressState {
  readonly stepId: string;
  /** 0 .. 1, clamped. */
  readonly progress: number;
  /** id of the next step in `stepOrder`, or null on the last step. */
  readonly nextStepId: string | null;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * The active section is the one whose `[top, top+height)` interval
 * contains the viewport midpoint. If the midpoint is above the first
 * section, the first section is reported with progress 0. If below the
 * last, the last is reported with progress 1.
 */
export function computeProgress(
  sections: ReadonlyArray<SectionRect>,
  scrollY: number,
  viewportHeight: number,
  stepOrder: ReadonlyArray<string>,
): ProgressState | null {
  if (sections.length === 0) return null;
  const mid = scrollY + viewportHeight / 2;

  let active: SectionRect | null = null;
  let activeIndex = -1;
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]!;
    if (mid >= s.top && mid < s.top + s.height) {
      active = s;
      activeIndex = i;
      break;
    }
  }
  if (!active) {
    // Before the first section (or sections all sit below midpoint).
    const first = sections[0]!;
    if (mid < first.top) {
      return progressFor(first, 0, stepOrder);
    }
    // After the last section.
    const last = sections[sections.length - 1]!;
    return progressFor(last, 1, stepOrder);
  }

  const t = active.height === 0 ? 0 : (mid - active.top) / active.height;
  return progressFor(active, clamp01(t), stepOrder, activeIndex);
}

function progressFor(
  section: SectionRect,
  progress: number,
  stepOrder: ReadonlyArray<string>,
  knownIndex?: number,
): ProgressState {
  const idx = knownIndex ?? stepOrder.indexOf(section.id);
  const next = idx >= 0 && idx + 1 < stepOrder.length ? stepOrder[idx + 1]! : null;
  return { stepId: section.id, progress, nextStepId: next };
}
