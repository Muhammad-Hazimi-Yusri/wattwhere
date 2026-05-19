import { describe, expect, it } from 'vitest';
import { floorHalfHourUTC, formatApiInstant } from './time';

describe('floorHalfHourUTC', () => {
  it('floors any instant to the previous half-hour boundary in UTC', () => {
    expect(floorHalfHourUTC(new Date('2026-05-17T12:17:30.500Z')).toISOString())
      .toBe('2026-05-17T12:00:00.000Z');
    expect(floorHalfHourUTC(new Date('2026-05-17T12:45:00.000Z')).toISOString())
      .toBe('2026-05-17T12:30:00.000Z');
    expect(floorHalfHourUTC(new Date('2026-05-17T12:30:00.000Z')).toISOString())
      .toBe('2026-05-17T12:30:00.000Z');
  });
});

describe('formatApiInstant', () => {
  it('formats an instant as YYYY-MM-DDThh:mmZ (no seconds)', () => {
    expect(formatApiInstant(new Date('2026-05-17T09:05:00.000Z')))
      .toBe('2026-05-17T09:05Z');
  });
});
