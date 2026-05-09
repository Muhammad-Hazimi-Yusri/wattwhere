import { useState } from 'react';
import {
  CARBON_INTENSITY_COLOURS,
  CARBON_INTENSITY_INDEXES,
  PLANT_SOURCE_COLOURS,
  SUBSTATION_COLOUR,
  VOLTAGE_COLOURS,
} from '../../lib/style/palette';

const PLANT_ROWS: Array<{ key: keyof typeof PLANT_SOURCE_COLOURS; label: string }> = [
  { key: 'wind', label: 'Wind' },
  { key: 'solar', label: 'Solar' },
  { key: 'hydro', label: 'Hydro' },
  { key: 'nuclear', label: 'Nuclear' },
  { key: 'gas', label: 'Gas' },
  { key: 'coal', label: 'Coal' },
  { key: 'oil', label: 'Oil' },
  { key: 'biomass', label: 'Biomass' },
  { key: 'battery', label: 'Battery' },
  { key: 'other', label: 'Other' },
];

function Swatch({ colour, shape = 'square' }: { colour: string; shape?: 'square' | 'circle' | 'line' }): JSX.Element {
  if (shape === 'circle') {
    return (
      <span
        aria-hidden="true"
        className="inline-block h-3 w-3 rounded-full ring-1 ring-white/40"
        style={{ background: colour }}
      />
    );
  }
  if (shape === 'line') {
    return (
      <span
        aria-hidden="true"
        className="inline-block h-1 w-4 rounded-full"
        style={{ background: colour }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 rounded-sm"
      style={{ background: colour }}
    />
  );
}

export default function Legend(): JSX.Element {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute top-4 right-14 z-10 rounded-md bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow ring-1 ring-white/10 hover:bg-black/85"
      >
        Show legend
      </button>
    );
  }

  return (
    <aside className="absolute top-4 right-14 z-10 w-56 max-w-[calc(100vw-5rem)] rounded-md bg-black/80 p-3 text-xs text-white shadow-lg ring-1 ring-white/10 backdrop-blur">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
          Legend
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide legend"
          className="-mr-1 -mt-1 rounded p-1 text-white/60 hover:text-white"
        >
          ×
        </button>
      </header>

      <section className="mb-3">
        <h3 className="mb-1 text-[10px] font-medium uppercase text-white/50">
          Carbon intensity (gCO₂/kWh)
        </h3>
        <div className="flex h-3 overflow-hidden rounded-sm ring-1 ring-white/20">
          {CARBON_INTENSITY_INDEXES.map((idx) => (
            <span
              key={idx}
              className="block h-full flex-1"
              style={{ background: CARBON_INTENSITY_COLOURS[idx] }}
              title={idx}
              aria-label={idx}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-white/60">
          <span>very low</span>
          <span>very high</span>
        </div>
      </section>

      <section className="mb-3">
        <h3 className="mb-1 text-[10px] font-medium uppercase text-white/50">
          Transmission lines
        </h3>
        <ul className="space-y-1">
          {(Object.keys(VOLTAGE_COLOURS) as Array<'132' | '275' | '400'>).map((kv) => (
            <li key={kv} className="flex items-center gap-2">
              <Swatch shape="line" colour={VOLTAGE_COLOURS[Number(kv) as 132 | 275 | 400]} />
              <span>{kv} kV</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-3">
        <h3 className="mb-1 text-[10px] font-medium uppercase text-white/50">
          Power plants
        </h3>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
          {PLANT_ROWS.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              <Swatch shape="circle" colour={PLANT_SOURCE_COLOURS[row.key]!} />
              <span>{row.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-1 text-[10px] font-medium uppercase text-white/50">Substations</h3>
        <div className="flex items-center gap-2">
          <Swatch shape="circle" colour={SUBSTATION_COLOUR} />
          <span>Visible at zoom ≥ 9</span>
        </div>
      </section>
    </aside>
  );
}
