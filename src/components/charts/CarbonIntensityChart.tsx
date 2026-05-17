import { useEffect, useRef, useState } from 'react';
import * as Plot from '@observablehq/plot';
import {
  fetchNational24h,
  type NationalPoint,
  type NationalSeries,
} from '../../lib/api/carbonintensity';
import {
  CARBON_INTENSITY_COLOURS,
} from '../../lib/style/palette';

type Status =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; series: NationalSeries };

interface MarkPoint {
  time: Date;
  value: number;
  series: 'actual' | 'forecast';
}

function toMarkPoints(points: readonly NationalPoint[]): MarkPoint[] {
  const out: MarkPoint[] = [];
  for (const p of points) {
    const time = new Date(p.from);
    out.push({ time, value: p.forecast, series: 'forecast' });
    if (p.actual !== null) {
      out.push({ time, value: p.actual, series: 'actual' });
    }
  }
  return out;
}

function lastActualTime(points: readonly NationalPoint[]): Date | null {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i]!.actual !== null) return new Date(points[i]!.to);
  }
  return null;
}

function formatHourLabel(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function preferredInitialOpen(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(min-width: 768px)').matches;
}

function buildPlot(series: NationalSeries, width: number): HTMLElement | SVGSVGElement {
  const data = toMarkPoints(series.points);
  const nowMark = lastActualTime(series.points);
  return Plot.plot({
    width,
    height: 160,
    marginTop: 12,
    marginRight: 14,
    marginBottom: 26,
    marginLeft: 36,
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
      label: 'gCO₂/kWh',
      labelOffset: 32,
      grid: true,
      nice: true,
      tickFormat: (d: number) => String(d),
    },
    color: {
      domain: ['actual', 'forecast'],
      range: ['#ffffff', 'rgba(255,255,255,0.45)'],
    },
    marks: [
      Plot.ruleY([0], { stroke: 'rgba(255,255,255,0.1)' }),
      Plot.line(data.filter((d) => d.series === 'forecast'), {
        x: 'time',
        y: 'value',
        stroke: 'rgba(255,255,255,0.45)',
        strokeDasharray: '2,3',
        strokeWidth: 1,
      }),
      Plot.line(data.filter((d) => d.series === 'actual'), {
        x: 'time',
        y: 'value',
        stroke: CARBON_INTENSITY_COLOURS.moderate,
        strokeWidth: 1.8,
      }),
      nowMark
        ? Plot.ruleX([nowMark], { stroke: 'rgba(255,255,255,0.5)', strokeWidth: 1 })
        : null,
    ].filter(Boolean) as Plot.Markish[],
  });
}

export default function CarbonIntensityChart(): JSX.Element {
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
    fetchNational24h({ signal: ctrl.signal })
      .then((series) => {
        if (!ctrl.signal.aborted) setStatus({ kind: 'ready', series });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[carbon-chart]', msg);
        setStatus({ kind: 'error', message: msg });
      });
    return () => ctrl.abort();
  }, [attempt]);

  useEffect(() => {
    const host = plotHostRef.current;
    if (!host || status.kind !== 'ready' || !open) return;
    const width = Math.max(220, Math.min(360, host.clientWidth || 320));
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
        className="absolute top-4 left-4 z-10 rounded-md bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow ring-1 ring-white/10 hover:bg-black/85"
      >
        24h carbon
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
      aria-label="National carbon intensity, last 24 hours"
      className="absolute top-4 left-4 z-10 w-[min(360px,calc(100vw-2rem))] rounded-md bg-black/80 p-3 text-xs text-white shadow-lg ring-1 ring-white/10 backdrop-blur"
    >
      <header className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
          National carbon · 24h
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide chart"
          className="-mr-1 -mt-1 rounded p-1 text-white/60 hover:text-white"
        >
          ×
        </button>
      </header>
      <p className="mb-2 text-[10px] text-white/55">{subtitle}</p>

      {status.kind === 'ready' ? (
        <>
          <div ref={plotHostRef} className="h-[160px] w-full" aria-hidden="true" />
          <ul className="mt-1 flex items-center gap-3 text-[10px] text-white/70">
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-[2px] w-3 rounded-full"
                style={{ background: CARBON_INTENSITY_COLOURS.moderate }}
              />
              actual
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-[2px] w-3 rounded-full"
                style={{
                  background:
                    'repeating-linear-gradient(to right, rgba(255,255,255,0.6) 0 2px, transparent 2px 5px)',
                }}
              />
              forecast
            </li>
          </ul>
        </>
      ) : status.kind === 'loading' ? (
        <div
          className="h-[160px] w-full animate-pulse rounded bg-white/5"
          role="status"
          aria-label="Loading carbon intensity chart"
        />
      ) : (
        <div role="status" className="flex h-[160px] items-center justify-center text-center">
          <p className="space-x-1 text-white/80">
            <span>Carbon data unavailable.</span>
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
