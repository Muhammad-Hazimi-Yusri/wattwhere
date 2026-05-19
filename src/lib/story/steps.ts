/**
 * Single source of truth for the scrolly narrative on `/`.
 *
 * Each Step describes a camera + overlay-visibility state. The Astro page
 * declares `<section data-step="…">` blocks whose IDs are keys here.
 * ScrollyController dispatches `STORY_STEP_EVENT` when a section enters the
 * viewport; StoryMap listens and applies the state to the MapLibre map.
 *
 * AGENTS.md: typed config keeps the surface tiny and lets steps.test.ts
 * catch typos before they ship.
 */

export type OverlaySet = 'carbon-regions' | 'power-infra';

export const OVERLAY_SETS: ReadonlyArray<OverlaySet> = [
  'carbon-regions',
  'power-infra',
] as const;

/**
 * Maps each overlay-set name to the layer IDs in
 * src/components/map/style.ts. Layer IDs are the public contract —
 * steps.test.ts asserts every one exists in buildStyle()'s output.
 *
 * Note: 'carto-base' and 'carto-labels' (basemap + labels) are always
 * visible and never appear here.
 */
export const OVERLAY_LAYER_IDS: Record<OverlaySet, ReadonlyArray<string>> = {
  'carbon-regions': ['gb-carbon-region-fill', 'gb-carbon-region-outline'],
  'power-infra': ['gb-power-line', 'gb-power-substation', 'gb-power-plant'],
};

export interface Step {
  readonly id: string;
  /** MapLibre order: [lon, lat]. */
  readonly center: readonly [number, number];
  readonly zoom: number;
  readonly overlays: ReadonlyArray<OverlaySet>;
  /**
   * Flow IDs (keys of FLOWS in `./flows.ts`) to animate on this step.
   * Optional; omitted means no flows on this step.
   */
  readonly flows?: ReadonlyArray<string>;
  readonly pitch?: number;
  readonly bearing?: number;
}

/** Camera + bounds limits — shared with StoryMap's MapLibre constructor. */
export const MAPLIBRE_MIN_ZOOM = 4;
export const MAPLIBRE_MAX_ZOOM = 14;
export const GB_LON_BOUNDS: readonly [number, number] = [-9, 2];
export const GB_LAT_BOUNDS: readonly [number, number] = [49, 61];

export const STEPS: Readonly<Record<string, Step>> = {
  intro: {
    id: 'intro',
    center: [-2.5, 54.5],
    zoom: 5.5,
    overlays: [],
    flows: [],
  },
  regions: {
    id: 'regions',
    center: [-2.5, 54.5],
    zoom: 5.5,
    overlays: ['carbon-regions'],
    flows: [],
  },
  plants: {
    id: 'plants',
    center: [-2.5, 55.5],
    zoom: 6,
    overlays: ['power-infra'],
    flows: ['scot-wind-to-london', 'dogger-to-london'],
  },
  'closer-look': {
    id: 'closer-look',
    center: [-0.1, 51.5],
    zoom: 9,
    overlays: ['power-infra'],
    flows: ['heysham-to-manchester', 'wylfa-to-midlands', 'ifa-to-south-coast'],
  },
  bill: {
    id: 'bill',
    // Bookends the story: same camera as `intro`, no overlays or flows
    // so the sticky map doesn't compete with the sankey in the article
    // column.
    center: [-2.5, 54.5],
    zoom: 5.5,
    overlays: [],
    flows: [],
  },
};

export const STEP_ORDER: ReadonlyArray<string> = [
  'intro',
  'regions',
  'plants',
  'closer-look',
  'bill',
];

// --- Event bus -------------------------------------------------------------

export const STORY_STEP_EVENT = 'wattwhere:story-step' as const;

export interface StoryStepEventDetail {
  readonly step: Step;
}

export type StoryStepEvent = CustomEvent<StoryStepEventDetail>;

/**
 * Resolve the EventTarget that hosts the bus. In the browser this is the
 * window object (so events cross island boundaries cleanly). In Node test
 * environments (where vitest runs with `environment: 'node'` and there is
 * no DOM), we share a module-local EventTarget so dispatch + listen still
 * round-trip.
 */
let _bus: EventTarget | null = null;
function getBus(): EventTarget {
  if (_bus) return _bus;
  _bus = typeof window !== 'undefined' ? window : new EventTarget();
  return _bus;
}

/** Dispatch a step transition. Components never touch the raw event name. */
export function dispatchStep(step: Step): void {
  const evt: StoryStepEvent = new CustomEvent(STORY_STEP_EVENT, {
    detail: { step },
  });
  getBus().dispatchEvent(evt);
}

/**
 * Register a typed listener for step transitions. Returns an unsubscribe
 * function that the caller MUST invoke on cleanup.
 */
export function onStoryStep(
  handler: (detail: StoryStepEventDetail) => void,
): () => void {
  const bus = getBus();
  const wrapped = (e: Event): void => {
    handler((e as StoryStepEvent).detail);
  };
  bus.addEventListener(STORY_STEP_EVENT, wrapped);
  return () => bus.removeEventListener(STORY_STEP_EVENT, wrapped);
}
