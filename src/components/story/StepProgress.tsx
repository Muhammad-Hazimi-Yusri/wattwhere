import { useEffect, useState } from 'react';
import { STEP_ORDER, STEPS, onStoryStep } from '../../lib/story/steps';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function labelFor(stepId: string): string {
  // Cheap title-case from the step id for the aria label / sr-only text.
  // Avoid yet-another-config; the ids are already user-facing strings.
  return stepId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Fixed right-edge dotted nav. Tracks the active step via the
 * STORY_STEP_EVENT bus. Each dot is clickable and scrolls the matching
 * [data-step] section into view (instant under reduced motion).
 */
export default function StepProgress(): JSX.Element {
  const [active, setActive] = useState<string>(STEP_ORDER[0] ?? '');

  useEffect(() => {
    const unsubscribe = onStoryStep(({ step }) => setActive(step.id));
    return unsubscribe;
  }, []);

  const onSelect = (id: string): void => {
    const el = document.querySelector<HTMLElement>(`[data-step="${id}"]`);
    if (!el) return;
    el.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  return (
    <nav
      aria-label="Story progress"
      className="pointer-events-none fixed right-2 top-1/2 z-30 -translate-y-1/2 pb-[env(safe-area-inset-bottom)] md:right-4"
    >
      <ol className="relative flex flex-col items-center gap-3">
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1 h-[calc(100%-0.5rem)] w-px -translate-x-1/2 bg-white/15"
        />
        {STEP_ORDER.map((id) => {
          const isActive = id === active;
          const step = STEPS[id];
          if (!step) return null;
          return (
            <li key={id} className="relative">
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={labelFor(id)}
                className={[
                  'pointer-events-auto block h-2.5 w-2.5 rounded-full transition-all duration-300',
                  isActive
                    ? 'scale-150 bg-[color:var(--accent)] ring-2 ring-[color:var(--accent)]/30'
                    : 'bg-white/40 ring-1 ring-white/30 hover:bg-white/70',
                ].join(' ')}
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
