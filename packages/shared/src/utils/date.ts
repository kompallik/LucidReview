import { subHours, subDays, isBefore, formatISO } from 'date-fns';

const DURATION_RE = /^(\d+)(h|d)$/;

function parseDuration(duration: string): { value: number; unit: 'h' | 'd' } {
  const match = DURATION_RE.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration format "${duration}". Expected "6h", "24h", "7d", "30d", etc.`);
  }
  return { value: Number(match[1]), unit: match[2] as 'h' | 'd' };
}

/**
 * Subtract a duration string (e.g. "6h", "24h", "7d") from a Date.
 */
export function subtractDuration(date: Date, duration: string): Date {
  const { value, unit } = parseDuration(duration);
  if (unit === 'h') return subHours(date, value);
  return subDays(date, value);
}

/**
 * Check if an observation timestamp falls within a lookback window.
 * E.g. isWithinLookback("2026-02-20T10:00:00Z", "6h") checks
 * if the observation is within the last 6 hours from now (or referenceDate).
 */
export function isWithinLookback(
  observedAt: Date | string,
  lookback: string,
  referenceDate?: Date
): boolean {
  const ref = referenceDate ?? new Date();
  const cutoff = subtractDuration(ref, lookback);
  const observed = typeof observedAt === 'string' ? new Date(observedAt) : observedAt;
  return !isBefore(observed, cutoff);
}

/**
 * Format a Date as a FHIR-compatible dateTime string (ISO 8601).
 */
export function toFhirDateTime(date: Date): string {
  return formatISO(date);
}
