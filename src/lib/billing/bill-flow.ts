/**
 * Illustrative breakdown of a typical GB electricity bill, expressed in
 * integer pence per £1 of bill so values sum without floating-point
 * drift. The shape is the public Ofgem default-tariff-cap composition —
 * a fan of cost components, and where each component goes downstream
 * (generators / network operators / government / supplier / HMRC).
 *
 * These numbers are ROUNDED and ILLUSTRATIVE. The figcaption on
 * BillFlowSankey makes that explicit. For up-to-date precision see
 * Ofgem's cap publications:
 *   https://www.ofgem.gov.uk/energy-policy-and-regulation/policy-and-regulatory-programmes/default-tariff-cap
 *
 * The two layers exist so the diagram tells a story (your bill → cost
 * bucket → where the money goes), not just a fan.
 */

export interface SankeyNode {
  readonly id: string;
  readonly label: string;
}

export interface SankeyLink {
  readonly source: string;
  readonly target: string;
  /** Pence per £1 of bill. */
  readonly valuePence: number;
}

export interface BillBreakdown {
  readonly nodes: ReadonlyArray<SankeyNode>;
  readonly links: ReadonlyArray<SankeyLink>;
  readonly subtotalPence: number;
}

export const BILL: BillBreakdown = {
  nodes: [
    { id: 'you',        label: 'Your bill (£1)' },
    // Layer 1 — cost components.
    { id: 'wholesale',  label: 'Wholesale energy' },
    { id: 'network',    label: 'Network costs' },
    { id: 'policy',     label: 'Policy costs' },
    { id: 'operating',  label: 'Supplier operating' },
    { id: 'margin',     label: 'Supplier margin' },
    { id: 'other',      label: 'Other (capacity etc.)' },
    { id: 'vat',        label: 'VAT (5%)' },
    // Layer 2 — where the money goes.
    { id: 'generators', label: 'Generators' },
    { id: 'tnos',       label: 'Transmission + DNOs' },
    { id: 'gov-policy', label: 'Govt. levies' },
    { id: 'supplier',   label: 'Supplier' },
    { id: 'hmrc',       label: 'HMRC' },
  ],
  links: [
    // your bill → cost buckets
    { source: 'you', target: 'wholesale', valuePence: 38 },
    { source: 'you', target: 'network',   valuePence: 22 },
    { source: 'you', target: 'policy',    valuePence: 14 },
    { source: 'you', target: 'operating', valuePence: 13 },
    { source: 'you', target: 'other',     valuePence: 7  },
    { source: 'you', target: 'vat',       valuePence: 5  },
    { source: 'you', target: 'margin',    valuePence: 1  },
    // cost buckets → recipients
    { source: 'wholesale', target: 'generators', valuePence: 38 },
    { source: 'network',   target: 'tnos',       valuePence: 22 },
    { source: 'policy',    target: 'gov-policy', valuePence: 14 },
    { source: 'operating', target: 'supplier',   valuePence: 13 },
    { source: 'other',     target: 'gov-policy', valuePence: 7  },
    { source: 'vat',       target: 'hmrc',       valuePence: 5  },
    { source: 'margin',    target: 'supplier',   valuePence: 1  },
  ],
  subtotalPence: 100,
};
