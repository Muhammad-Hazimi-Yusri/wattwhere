import { useEffect } from 'react';
import { computeProgress, type SectionRect } from '../../lib/story/progress';
import { STEP_ORDER, dispatchProgress } from '../../lib/story/steps';

/**
 * Mount once at the page level. Caches the document-coordinate rects of
 * every `[data-step]` section, listens to passive window scroll, and
 * dispatches `'wattwhere:story-progress'` on every animation frame
 * while scrolling. StoryMap LERPs its camera against these events;
 * StepProgress can also subscribe.
 *
 * Re-caches on resize and on any DOM mutation under <main> (e.g. font
 * swap causing reflow). Initial dispatch fires after one rAF so layout
 * has settled.
 */
export function useStoryProgress(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rects: SectionRect[] = [];

    const measure = (): void => {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>('[data-step]'),
      );
      const scrollY = window.scrollY;
      rects = els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.step ?? '',
          top: r.top + scrollY,
          height: r.height,
        };
      });
    };

    let pending = false;
    const tick = (): void => {
      pending = false;
      const state = computeProgress(rects, window.scrollY, window.innerHeight, STEP_ORDER);
      if (state) dispatchProgress(state);
    };
    const schedule = (): void => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(tick);
    };

    measure();
    // First dispatch on the next frame so any font/layout reflow has settled.
    requestAnimationFrame(() => {
      measure();
      tick();
    });

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', () => {
      measure();
      schedule();
    });

    const main = document.querySelector('main');
    let mo: MutationObserver | null = null;
    if (main) {
      mo = new MutationObserver(() => {
        measure();
        schedule();
      });
      mo.observe(main, { childList: true, subtree: true });
    }

    return () => {
      window.removeEventListener('scroll', schedule);
      mo?.disconnect();
    };
  }, []);
}
