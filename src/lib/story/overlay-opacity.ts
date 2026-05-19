/**
 * Per-layer baseline opacity for the toggleable overlay layers in
 * `src/components/map/style.ts`. Single source of truth for both the
 * style defaults (visible state) and the StoryMap on/off transition
 * targets. The accompanying steps.test.ts case asserts coverage so
 * style.ts and this table can't drift.
 */

export interface LayerOpacityBaseline {
  /** The MapLibre paint property name for opacity on this layer. */
  readonly prop: 'fill-opacity' | 'line-opacity' | 'circle-opacity';
  /** The visible (active) value. Off state is always 0. */
  readonly baseline: number;
}

export const OVERLAY_OPACITY: Readonly<Record<string, LayerOpacityBaseline>> = {
  'gb-carbon-region-fill':    { prop: 'fill-opacity',    baseline: 0.45 },
  'gb-carbon-region-outline': { prop: 'line-opacity',    baseline: 0.45 },
  'gb-power-line':            { prop: 'line-opacity',    baseline: 0.85 },
  'gb-power-substation':      { prop: 'circle-opacity',  baseline: 0.9  },
  'gb-power-plant':           { prop: 'circle-opacity',  baseline: 0.9  },
};

/** Layer IDs whose opacity transitions should be zeroed under
 * `prefers-reduced-motion: reduce`. Same set as the keys of
 * OVERLAY_OPACITY — exported separately for clarity at call sites. */
export const TRANSITION_LAYER_IDS: ReadonlyArray<string> = Object.keys(OVERLAY_OPACITY);
