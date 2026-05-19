/**
 * Pure time utilities shared across API clients (carbonintensity, bmrs).
 * No I/O, no DOM. Imported wherever an external API expects a half-hour
 * settlement-period boundary or an ISO instant without seconds.
 */

/**
 * Round a Date down to the previous half-hour boundary (00 or 30
 * minutes, 0 ms). Matches the settlement-period grid used by both the
 * Carbon Intensity API and BMRS.
 */
export function floorHalfHourUTC(d: Date): Date {
  const ms = d.getTime();
  return new Date(ms - (ms % (30 * 60 * 1000)));
}

/** Format an instant as `YYYY-MM-DDThh:mmZ` (no seconds). */
export function formatApiInstant(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`
  );
}
