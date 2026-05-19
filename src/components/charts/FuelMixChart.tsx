import { useEffect, useRef, useState } from 'react';
import * as Plot from '@observablehq/plot';
import {
  FUEL_TYPES,
  fetchFuelInst24h,
  type FuelInstSeries,
  type FuelType,
} from '../../lib/api/bmrs';
import { FUEL_COLOURS } from '../../lib/style/palette';

type Status =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; series: FuelInstSeries };

interface StackRow {
  time: Date;
  fuel: FuelType;
  mw: number;
}

function toStackRows(series: FuelInstSeries): StackRow[] {
  const out: StackRow[] = [];
  for (const p of series.points) {
    const time = new Date(p.time);
    for (const [fuel, mw] of Object.entries(p.fuels)) {
      if (typeof mw !== 'number') continue;
      out.push({ time, fuel: fuel as FuelType, mw });
    }
  }
  return out;
}

function formatHourLabel(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function preferredInitialOpen(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(min-width: 768px)').matches;
}

function buildPlot(series: FuelInstSeries, width: number): HTMLElement | SVGSVGElement {
  const data = toStackRows(series);
  const domain = FUEL_TYPES.filter((f) => data.some((d) => d.fuel === f));
  const range = domain.map((f) => FUEL_COLOURS[f] ?? '#888');
  return Plot.plot({
    width,
    height: 180,
    marginTop: 12,
    marginRight: 14,
    marginBottom: 26,
    marginLeft: 42,
    style: {
      background: 'transparent',
      color: 'rgba(255,255,255,0.85)',
      fontSize: '10px',
      overflow: 'visible',
    },
    x: {
      type: 'utc',
      label: null,
      ticks: 4,
      tickFormat: (d: Date) => formatHourLabel(d),
    },
    y: {
      label: 'MW',
      labelOffset: 36,
      grid: true,
      nice: true,
    },
    color: {
      domain: [...domain],
      range,
      legend: false,
    },
    marks: [
      Plot.areaY(data, {
        x: 'time',
        y: 'mw',
        fill: 'fuel',
        order: 'sum',
        stroke: 'rgba(0,0,0,0.15)',
        strokeWidth: 0.5,
      }),
    ],
  });
}

export default function FuelMixChart(): JSX.Element {
  const [open, setOpen] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const plotHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpen(preferredInitialOpen());
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setStatus({ kind: 'loading' });
    fetchFuelInst24h({ signal: ctrl.signal })
      .then((series) => {
        if (!ctrl.signal.aborted) setStatus({ kind: 'ready', series });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[fuel-mix]', msg);
        setStatus({ kind: 'error', message: msg });
      });
    return () => ctrl.abort();
  }, [attempt]);

  useEffect(() => {
    const host = plotHostRef.current;
    if (!host || status.kind !== 'ready' || !open) return;
    const width = Math.max(280, Math.min(420, host.clientWidth || 360));
    const node = buildPlot(status.series, width);
    host.replaceChildren(node);
    return () => {
      if (node.parentNode === host) host.replaceChildren();
    };
  }, [status, open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-4 left-4 z-10 rounded-md bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow ring-1 ring-white/10 hover:bg-black/85"
      >
        24h fuel mix
      </button>
    );
  }

  const subtitle =
    status.kind === 'ready'
      ? `${formatHourLabel(new Date(status.series.from))} → ${formatHourLabel(
          new Date(status.series.to),
        )} (local)`
      : status.kind === 'loading'
        ? 'loading…'
        : 'data unavailable';

  return (
    <aside
      aria-label="GB fuel mix, last 24 hours"
      className="absolute bottom-4 left-4 z-10 w-[min(420px,calc(100vw-2rem))] rounded-md bg-black/80 p-3 text-xs text-white shadow-lg ring-1 ring-white/10 backdrop-blur"
    >
      <header className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
          Fuel mix · 24h
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide fuel mix chart"
          className="-mr-1 -mt-1 rounded p-1 text-white/60 hover:text-white"
        >
          ×
        </button>
      </header>
      <p className="mb-2 text-[10px] text-white/55">{subtitle}</p>

      {status.kind === 'ready' ? (
        <>
          <div ref={plotHostRef} className="h-[180px] w-full" aria-hidden="true" />
          <p className="mt-1 text-[9px] text-white/45">
            Contains BMRS data © Elexon Limited copyright and database
            right 2026.
          </p>
        </>
      ) : status.kind === 'loading' ? (
        <div
          className="h-[180px] w-full animate-pulse rounded bg-white/5"
          role="status"
          aria-label="Loading fuel mix chart"
        />
      ) : (
        <div role="status" className="flex h-[180px] items-center justify-center text-center">
          <p className="space-x-1 text-white/80">
            <span>Fuel mix data unavailable.</span>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="underline underline-offset-2 hover:text-white"
            >
              Retry
            </button>
          </p>
        </div>
      )}
    </aside>
  );
}
