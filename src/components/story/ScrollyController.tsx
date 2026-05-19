import { useEffect } from 'react';
import scrollama from 'scrollama';
import { STEPS, dispatchStep } from '../../lib/story/steps';

/**
 * Single tuning constant: the fraction of the viewport from the top at which
 * a `[data-step]` section "enters". With a 60vh sticky map on top of mobile,
 * raise toward 0.7 if 0.5 feels late. One place to change.
 */
const TRIGGER_OFFSET = 0.5;

export default function ScrollyController(): null {
  useEffect(() => {
    const scroller = scrollama();

    scroller
      .setup({
        step: '[data-step]',
        offset: TRIGGER_OFFSET,
      })
      .onStepEnter(({ element }) => {
        const id = (element as HTMLElement).dataset.step;
        if (!id) return;
        const step = STEPS[id];
        if (!step) {
          console.warn('[scrolly] unknown step id', id);
          return;
        }
        dispatchStep(step);
      });

    const onResize = (): void => {
      scroller.resize();
    };
    window.addEventListener('resize', onResize);

    // Scrollama's onStepEnter only fires on changes, so a step already
    // past the trigger line at mount won't publish. Dispatch the first
    // step explicitly so StoryMap has a consistent initial state even on
    // mid-scroll refresh.
    const initial = document.querySelector<HTMLElement>('[data-step]');
    const initialId = initial?.dataset.step;
    if (initialId && STEPS[initialId]) {
      dispatchStep(STEPS[initialId]);
    }

    // Section-enter fade-up: set data-seen='true' once per section the
    // first time any part of it enters the viewport. CSS in global.css
    // gates the animation on the data attribute and respects
    // prefers-reduced-motion.
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.seen = 'true';
          reveal.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    for (const el of document.querySelectorAll<HTMLElement>('[data-step]')) {
      reveal.observe(el);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      scroller.destroy();
      reveal.disconnect();
    };
  }, []);

  return null;
}
