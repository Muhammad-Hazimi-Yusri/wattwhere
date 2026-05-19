import { BILL, type SankeyLink } from '../../lib/billing/bill-flow';

/**
 * Wrapped-style replacement for the d3-sankey bill view. One card per
 * cost bucket showing the pence, where it goes, and a one-line context.
 * Mobile is a horizontal scroll-snap strip (touch-action: pan-x to
 * avoid gesture conflict with the page's vertical scroll); desktop is
 * a 3- or 4-col grid.
 */

interface CardSpec {
  readonly id: string;
  readonly pence: number;
  readonly label: string;
  readonly dest: string;
  readonly hint: string;
  readonly colour: string;
}

const COST_LABEL: Record<string, string> = {
  wholesale: 'Wholesale energy',
  network: 'Network costs',
  policy: 'Policy costs',
  operating: 'Supplier operating',
  other: 'Other',
  vat: 'VAT (5%)',
  margin: 'Supplier margin',
};

const RECIPIENT_LABEL: Record<string, string> = {
  generators: 'Generators',
  tnos: 'Transmission + DNOs',
  'gov-policy': 'Govt. levies',
  supplier: 'Your supplier',
  hmrc: 'HMRC',
};

const HINT: Record<string, string> = {
  wholesale: 'The power itself',
  network: 'Pylons, wires, substations',
  policy: 'Green schemes, social tariffs',
  operating: 'Billing, customer service',
  other: 'Capacity market, balancing',
  vat: "The chancellor's slice",
  margin: 'Profit',
};

const COLOUR: Record<string, string> = {
  wholesale: '#E69F00', // gas
  network: '#ef8a62',   // 400 kV
  policy: '#CC79A7',    // nuclear
  operating: '#67a9cf', // 132 kV
  other: '#9b9b9b',
  vat: '#fee08b',       // carbon moderate
  margin: '#666666',
};

function buildCards(): CardSpec[] {
  // Each cost bucket has exactly one "you → bucket" link with the
  // pence value, and at least one "bucket → recipient" link. Walk the
  // table once, key on bucket id, join to the recipient. Drops the
  // "other → gov-policy" duplicate target into the existing card.
  const peneByBucket = new Map<string, number>();
  for (const l of BILL.links) {
    if (l.source === 'you') peneByBucket.set(l.target, l.valuePence);
  }
  const bucketToRecipient = new Map<string, SankeyLink>();
  for (const l of BILL.links) {
    if (l.source !== 'you' && !bucketToRecipient.has(l.source)) {
      bucketToRecipient.set(l.source, l);
    }
  }

  const cards: CardSpec[] = [];
  for (const [bucket, pence] of peneByBucket) {
    const recipient = bucketToRecipient.get(bucket);
    if (!recipient) continue;
    cards.push({
      id: bucket,
      pence,
      label: COST_LABEL[bucket] ?? bucket,
      dest: RECIPIENT_LABEL[recipient.target] ?? recipient.target,
      hint: HINT[bucket] ?? '',
      colour: COLOUR[bucket] ?? '#888',
    });
  }
  // Descending by pence — Wrapped reveal of biggest slice first.
  cards.sort((a, b) => b.pence - a.pence);
  return cards;
}

export default function BillFlowCards(): JSX.Element {
  const cards = buildCards();
  return (
    <figure className="my-6">
      <ol
        aria-label="Where each pound of an electricity bill goes"
        className="flex snap-x snap-mandatory overflow-x-auto px-4 -mx-4 pb-4 gap-3 scroll-px-4 [touch-action:pan-x] md:mx-0 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:px-0 md:pb-0 md:snap-none md:[touch-action:auto] lg:grid-cols-4"
      >
        {cards.map((c) => (
          <li
            key={c.id}
            className="w-[78vw] max-w-[280px] flex-shrink-0 snap-center md:w-auto md:max-w-none md:flex-shrink"
          >
            <article
              style={{ '--card-accent': c.colour } as React.CSSProperties}
              className="flex h-full flex-col justify-between rounded-xl bg-white/[0.04] ring-1 ring-white/10 p-4 aspect-[3/4] md:aspect-auto md:min-h-[160px] md:p-5"
            >
              <p
                className="text-5xl md:text-6xl font-semibold tabular-nums tracking-tight leading-none"
                style={{ color: 'var(--card-accent)' }}
              >
                {c.pence}p
              </p>
              <div className="space-y-1">
                <p className="text-base md:text-lg font-medium text-white">
                  {c.label}
                </p>
                <p className="text-sm text-white/70">
                  <span aria-hidden="true">→ </span>
                  {c.dest}
                </p>
                {c.hint ? (
                  <p className="text-xs text-white/50">{c.hint}</p>
                ) : null}
              </div>
            </article>
          </li>
        ))}
      </ol>
      <figcaption className="mt-2 text-[10px] text-white/55">
        Illustrative breakdown of a £1 dual-fuel electricity bill,
        rounded to the nearest penny. Cost shares follow the structure
        of Ofgem's default tariff cap; values are not pinned to a
        specific cap period.
      </figcaption>
    </figure>
  );
}
