import { useEffect, useMemo, useRef, useState } from 'react';
import {
  sankey,
  sankeyLinkHorizontal,
  type SankeyGraph,
  type SankeyNode as D3SankeyNode,
} from 'd3-sankey';
import { BILL } from '../../lib/billing/bill-flow';

interface InNode {
  id: string;
  label: string;
}
interface InLink {
  source: string;
  target: string;
  value: number;
}

const NODE_WIDTH = 14;
const NODE_PADDING = 14;
const MARGIN = { top: 20, right: 130, bottom: 24, left: 14 };
const COLOURS: Record<string, string> = {
  you: '#58a6ff',
  wholesale: '#E69F00',
  network: '#67a9cf',
  policy: '#CC79A7',
  operating: '#999999',
  margin: '#666666',
  other: '#888888',
  vat: '#fee08b',
  generators: '#56B4E9',
  tnos: '#0072B2',
  'gov-policy': '#CC79A7',
  supplier: '#9b9b9b',
  hmrc: '#fee08b',
};

function colourFor(id: string): string {
  return COLOURS[id] ?? '#888';
}

export default function BillFlowSankey(): JSX.Element {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(560);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === 'number' && w > 0) setWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const height = Math.max(320, Math.min(440, BILL.nodes.length * 32));
    // d3-sankey mutates inputs. Clone every render.
    const nodes: InNode[] = BILL.nodes.map((n) => ({ id: n.id, label: n.label }));
    const links: InLink[] = BILL.links.map((l) => ({
      source: l.source,
      target: l.target,
      value: l.valuePence,
    }));
    const generator = sankey<InNode, InLink>()
      .nodeId((n) => n.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .extent([
        [MARGIN.left, MARGIN.top],
        [width - MARGIN.right, height - MARGIN.bottom],
      ]);
    const graph: SankeyGraph<InNode, InLink> = generator({
      nodes: nodes as never,
      links: links as never,
    });
    return { graph, height };
  }, [width]);

  const linkPath = sankeyLinkHorizontal<InNode, InLink>();

  return (
    <figure
      ref={wrapRef}
      className="my-4 rounded-md bg-black/60 p-4 ring-1 ring-white/10"
    >
      <figcaption className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/80">
        Where each £1 of your bill goes
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${layout.height}`}
        role="img"
        aria-label="Sankey diagram: where each pound of your electricity bill flows"
        className="block w-full"
      >
        <g>
          {layout.graph.links.map((l, i) => {
            const path = linkPath(l) ?? '';
            const sourceId = (l.source as D3SankeyNode<InNode, InLink>).id ?? '';
            return (
              <path
                key={`l-${i}`}
                d={path}
                fill="none"
                stroke={colourFor(sourceId)}
                strokeOpacity={0.35}
                strokeWidth={Math.max(1, l.width ?? 1)}
              >
                <title>
                  {`${(l.source as D3SankeyNode<InNode, InLink>).label} → ${
                    (l.target as D3SankeyNode<InNode, InLink>).label
                  }: ${l.value}p`}
                </title>
              </path>
            );
          })}
        </g>
        <g>
          {layout.graph.nodes.map((n) => {
            const id = n.id;
            const x0 = n.x0 ?? 0;
            const x1 = n.x1 ?? 0;
            const y0 = n.y0 ?? 0;
            const y1 = n.y1 ?? 0;
            const labelOnRight = x0 < width / 2;
            return (
              <g key={`n-${id}`}>
                <rect
                  x={x0}
                  y={y0}
                  width={Math.max(0, x1 - x0)}
                  height={Math.max(0, y1 - y0)}
                  fill={colourFor(id)}
                  opacity={0.9}
                >
                  <title>{`${n.label}: ${n.value ?? 0}p`}</title>
                </rect>
                <text
                  x={labelOnRight ? x1 + 6 : x0 - 6}
                  y={(y0 + y1) / 2}
                  dy="0.35em"
                  textAnchor={labelOnRight ? 'start' : 'end'}
                  fontSize={11}
                  fill="rgba(255,255,255,0.85)"
                >
                  {n.label}
                  <tspan dx="0.3em" fill="rgba(255,255,255,0.55)">
                    {`${n.value ?? 0}p`}
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <p className="mt-2 text-[10px] text-white/55">
        Illustrative breakdown of a £1 dual-fuel electricity bill,
        rounded to the nearest penny. Cost shares follow the structure
        of Ofgem's default tariff cap; values are not pinned to a
        specific cap period.
      </p>
    </figure>
  );
}
