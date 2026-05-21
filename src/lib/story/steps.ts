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

export type OverlaySet =
  | 'carbon-regions'
  | 'power-plants'
  | 'power-lines'
  | 'power-substations';

export const OVERLAY_SETS: ReadonlyArray<OverlaySet> = [
  'carbon-regions',
  'power-plants',
  'power-lines',
  'power-substations',
] as const;

/**
 * Maps each overlay-set name to the layer IDs in
 * src/components/map/style.ts. Layer IDs are the public contract —
 * steps.test.ts asserts every one exists in buildStyle()'s output.
 *
 * Power infra is split per layer so each journey step can emphasise just
 * one rung of the grid (plants at the source, lines on the transmission
 * leg, substations as the power reaches the street).
 *
 * Note: 'carto-base' and 'carto-labels' (basemap + labels) are always
 * visible and never appear here.
 */
export const OVERLAY_LAYER_IDS: Record<OverlaySet, ReadonlyArray<string>> = {
  'carbon-regions': ['gb-carbon-region-fill', 'gb-carbon-region-outline'],
  'power-plants': ['gb-power-plant'],
  'power-lines': ['gb-power-line'],
  'power-substations': ['gb-power-substation'],
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
export const MAPLIBRE_MAX_ZOOM = 16;
export const GB_LON_BOUNDS: readonly [number, number] = [-9, 2];
export const GB_LAT_BOUNDS: readonly [number, number] = [49, 61];

// The "follow one electron" journey: a single guided dive from Dogger
// Bank to a London home. Zoom climbs monotonically through `home`; the
// centre tracks south. The single `dogger-journey` flow follows the
// path on steps 2–6 and gives the dive its direction.
export const STEPS: Readonly<Record<string, Step>> = {
  overview: {
    id: 'overview',
    // Whole-GB establishing shot with the live carbon-intensity fill.
    center: [-2.5, 54.5],
    zoom: 5.5,
    overlays: ['carbon-regions'],
    flows: [],
  },
  generation: {
    id: 'generation',
    // North Sea, nudged west of Dogger Bank so the Yorkshire coast (the
    // landfall the flow heads for) stays in frame alongside the turbines.
    center: [1.15, 54.85],
    zoom: 6.8,
    overlays: ['power-plants'],
    flows: ['dogger-journey'],
  },
  transmission: {
    id: 'transmission',
    // The 400 kV corridor heading south; Creyke Beck landfall sits near
    // the top of frame.
    center: [-0.45, 53.4],
    zoom: 7.0,
    overlays: ['power-lines'],
    flows: ['dogger-journey'],
  },
  'grid-supply': {
    id: 'grid-supply',
    // London's northern edge — where transmission hands over to the
    // distribution network. Lines + substations both lit.
    center: [-0.05, 51.6],
    zoom: 9.8,
    overlays: ['power-lines', 'power-substations'],
    flows: ['dogger-journey'],
  },
  distribution: {
    id: 'distribution',
    center: [-0.11, 51.52],
    zoom: 12.5,
    overlays: ['power-substations'],
    flows: ['dogger-journey'],
  },
  home: {
    id: 'home',
    // Street level: ~81 real OSM substations in frame; the flow ends here.
    center: [-0.12, 51.505],
    zoom: 15,
    overlays: ['power-substations'],
    flows: ['dogger-journey'],
  },
  bill: {
    id: 'bill',
    // Stay over the home (z14, gentle exhale — not a pull-back to GB,
    // which would re-introduce the "pop out"). Overlays + flow off so
    // the map recedes behind the bill cards in the article column.
    center: [-0.12, 51.505],
    zoom: 14,
    overlays: [],
    flows: [],
  },
};

export const STEP_ORDER: ReadonlyArray<string> = [
  'overview',
  'generation',
  'transmission',
  'grid-supply',
  'distribution',
  'home',
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

// --- Continuous scroll progress bus ---------------------------------------
//
// `STORY_STEP_EVENT` fires once per section ENTER (driven by Scrollama).
// `STORY_PROGRESS_EVENT` fires every animation frame while scrolling,
// carrying a t ∈ [0, 1] of how far the viewport midpoint is through the
// currently-active step. Used by StoryMap to LERP the camera continuously
// rather than relying on a discrete flyTo at each step boundary.

export const STORY_PROGRESS_EVENT = 'wattwhere:story-progress' as const;

export interface StoryProgressEventDetail {
  readonly stepId: string;
  /** 0..1 within the currently-active step. */
  readonly progress: number;
  /** id of the next step in STEP_ORDER, or null if on the last step. */
  readonly nextStepId: string | null;
}

export type StoryProgressEvent = CustomEvent<StoryProgressEventDetail>;

export function dispatchProgress(detail: StoryProgressEventDetail): void {
  const evt: StoryProgressEvent = new CustomEvent(STORY_PROGRESS_EVENT, {
    detail,
  });
  getBus().dispatchEvent(evt);
}

export function onStoryProgress(
  handler: (detail: StoryProgressEventDetail) => void,
): () => void {
  const bus = getBus();
  const wrapped = (e: Event): void => {
    handler((e as StoryProgressEvent).detail);
  };
  bus.addEventListener(STORY_PROGRESS_EVENT, wrapped);
  return () => bus.removeEventListener(STORY_PROGRESS_EVENT, wrapped);
}
