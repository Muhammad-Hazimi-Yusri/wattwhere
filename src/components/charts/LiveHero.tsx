import { useEffect, useState } from 'react';
import {
  fetchNational24h,
  latestActual,
  type NationalPoint,
} from '../../lib/api/carbonintensity';
import {
  fetchFuelInst24h,
  latestPoint,
  lowCarbonShare,
  totalMW,
  type FuelInstPoint,
  type FuelType,
} from '../../lib/api/bmrs';
import {
  CARBON_INTENSITY_COLOURS,
  FUEL_COLOURS,
} from '../../lib/style/palette';

interface Live {
  carbon: NationalPoint | null;
  fuel: FuelInstPoint | null;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; live: Live }
  | { kind: 'error' };

const FUEL_LABELS: Partial<Record<FuelType, string>> = {
  CCGT: 'Gas',
  OCGT: 'Gas (peaking)',
  COAL: 'Coal',
  OIL: 'Oil',
  NUCLEAR: 'Nuclear',
  BIOMASS: 'Biomass',
  WIND: 'Wind',
  OFFSHORE_WIND: 'Offshore wind',
  SOLAR: 'Solar',
  HYDRO: 'Hydro',
  PUMP_STORAGE: 'Pumped storage',
  INTERCONNECTOR: 'Imports',
  OTHER: 'Other',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sortedFuels(point: FuelInstPoint): Array<{ fuel: FuelType; mw: number }> {
  return (Object.entries(point.fuels) as Array<[FuelType, number]>)
    .filter(([, mw]) => mw > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([fuel, mw]) => ({ fuel, mw }));
}

function FuelBar({ point }: { point: FuelInstPoint }): JSX.Element {
  const total = totalMW(point);
  const fuels = sortedFuels(point);
  return (
    <div className="mt-6">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-white/15"
        role="img"
        aria-label="Current generation mix by fuel"
      >
        {fuels.map(({ fuel, mw }) => (
          <span
            key={fuel}
            title={`${FUEL_LABELS[fuel] ?? fuel}: ${Math.round((mw / total) * 100)}%`}
            style={{ width: `${(mw / total) * 100}%`, background: FUEL_COLOURS[fuel] ?? '#888' }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
        {fuels.slice(0, 5).map(({ fuel, mw }) => (
          <li key={fuel} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: FUEL_COLOURS[fuel] ?? '#888' }}
            />
            {FUEL_LABELS[fuel] ?? fuel} {Math.round((mw / total) * 100)}%
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LiveHero(): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setStatus({ kind: 'loading' });
    Promise.allSettled([
      fetchNational24h({ signal: ctrl.signal }),
      fetchFuelInst24h({ signal: ctrl.signal }),
    ]).then(([c, f]) => {
      if (ctrl.signal.aborted) return;
      const carbon = c.status === 'fulfilled' ? latestActual(c.value) : null;
      const fuel = f.status === 'fulfilled' ? latestPoint(f.value) : null;
      if (!carbon && !fuel) setStatus({ kind: 'error' });
      else setStatus({ kind: 'ready', live: { carbon, fuel } });
    });
    return () => ctrl.abort();
  }, [attempt]);

  if (status.kind === 'error') {
    return (
      <div role="status" className="text-white/80">
        <p className="text-lg">Live grid data unavailable right now.</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="mt-3 rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
        >
          Retry
        </button>
      </div>
    );
  }

  if (status.kind === 'loading') {
    return (
      <div role="status" aria-label="Loading the live grid" className="space-y-4">
        <div className="h-[4rem] w-3/4 animate-pulse rounded bg-white/5 md:h-[7rem]" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-white/5" />
        <div className="h-3 w-full animate-pulse rounded-full bg-white/5" />
      </div>
    );
  }

  const { carbon, fuel } = status.live;
  const accent = carbon ? CARBON_INTENSITY_COLOURS[carbon.index] : 'var(--accent)';
  const pct = fuel ? Math.round(lowCarbonShare(fuel) * 100) : null;
  const asOf = carbon ? formatTime(carbon.to) : fuel ? formatTime(fuel.time) : '';

  return (
    <div className="relative" style={{ '--glow': accent } as React.CSSProperties}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-16 -top-24 -z-10 h-72 opacity-30 blur-3xl"
        style={{ background: `radial-gradient(60% 60% at 30% 40%, var(--glow), transparent 70%)` }}
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
        Right now · Britain's grid
      </p>

      {carbon ? (
        <>
          <p
            className="mt-2 text-[4rem] leading-none md:text-[7rem] font-semibold tracking-tight tabular-nums"
            style={{ color: accent }}
            aria-label={`${carbon.actual} grams of CO2 per kilowatt hour`}
          >
            {carbon.actual}
            <span className="ml-2 align-baseline text-lg md:text-2xl font-medium text-white/60">
              gCO₂/kWh
            </span>
          </p>
          <p className="mt-2 text-xl md:text-2xl font-medium capitalize" style={{ color: accent }}>
            {carbon.index}
            {pct !== null && (
              <span className="text-white"> · {pct}% low-carbon</span>
            )}
          </p>
        </>
      ) : (
        pct !== null && (
          <p
            className="mt-2 text-[4rem] leading-none md:text-[7rem] font-semibold tracking-tight tabular-nums"
            style={{ color: 'var(--accent)' }}
          >
            {pct}%
            <span className="ml-2 text-lg md:text-2xl font-medium text-white/60">low-carbon</span>
          </p>
        )
      )}

      {fuel && <FuelBar point={fuel} />}

      {asOf && <p className="mt-4 text-xs text-white/45">as of {asOf} · live</p>}
    </div>
  );
}
