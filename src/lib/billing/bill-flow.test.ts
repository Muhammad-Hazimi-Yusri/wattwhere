import { describe, expect, it } from 'vitest';
import { BILL } from './bill-flow';

describe('BILL invariants', () => {
  it('every link references existing nodes', () => {
    const ids = new Set(BILL.nodes.map((n) => n.id));
    for (const l of BILL.links) {
      expect(ids.has(l.source)).toBe(true);
      expect(ids.has(l.target)).toBe(true);
    }
  });

  it('node IDs are unique', () => {
    const ids = BILL.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every link value is a positive integer', () => {
    for (const l of BILL.links) {
      expect(Number.isInteger(l.valuePence)).toBe(true);
      expect(l.valuePence).toBeGreaterThan(0);
    }
  });

  it('flows out of "you" sum to subtotalPence', () => {
    const out = BILL.links
      .filter((l) => l.source === 'you')
      .reduce((acc, l) => acc + l.valuePence, 0);
    expect(out).toBe(BILL.subtotalPence);
  });

  it('each cost bucket conserves: outflows match inflows from you', () => {
    const inFromYou: Record<string, number> = {};
    for (const l of BILL.links) {
      if (l.source === 'you') inFromYou[l.target] = l.valuePence;
    }
    for (const [bucket, value] of Object.entries(inFromYou)) {
      const out = BILL.links
        .filter((l) => l.source === bucket)
        .reduce((acc, l) => acc + l.valuePence, 0);
      expect(out).toBe(value);
    }
  });

  it('total recipient inflow equals subtotalPence', () => {
    const recipientIds = new Set(['generators', 'tnos', 'gov-policy', 'supplier', 'hmrc']);
    const inflow = BILL.links
      .filter((l) => recipientIds.has(l.target))
      .reduce((acc, l) => acc + l.valuePence, 0);
    expect(inflow).toBe(BILL.subtotalPence);
  });
});
