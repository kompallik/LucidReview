import { describe, it, expect } from 'vitest';
import { subtractDuration, isWithinLookback, toFhirDateTime } from './date.js';

describe('subtractDuration', () => {
  const base = new Date('2026-02-20T12:00:00.000Z');

  it('subtracts 6 hours', () => {
    const result = subtractDuration(base, '6h');
    expect(result.toISOString()).toBe('2026-02-20T06:00:00.000Z');
  });

  it('subtracts 24 hours', () => {
    const result = subtractDuration(base, '24h');
    expect(result.toISOString()).toBe('2026-02-19T12:00:00.000Z');
  });

  it('subtracts 7 days', () => {
    const result = subtractDuration(base, '7d');
    expect(result.toISOString()).toBe('2026-02-13T12:00:00.000Z');
  });

  it('subtracts 30 days', () => {
    const result = subtractDuration(base, '30d');
    expect(result.toISOString()).toBe('2026-01-21T12:00:00.000Z');
  });

  it('throws on invalid format', () => {
    expect(() => subtractDuration(base, '6m')).toThrow('Invalid duration format');
    expect(() => subtractDuration(base, 'abc')).toThrow('Invalid duration format');
    expect(() => subtractDuration(base, '')).toThrow('Invalid duration format');
  });
});

describe('isWithinLookback', () => {
  const ref = new Date('2026-02-20T12:00:00.000Z');

  it('returns true for an observation within the lookback window', () => {
    // 3 hours ago is within a 6h lookback
    expect(isWithinLookback('2026-02-20T09:00:00.000Z', '6h', ref)).toBe(true);
  });

  it('returns true for an observation exactly at the cutoff', () => {
    // Exactly 6 hours ago
    expect(isWithinLookback('2026-02-20T06:00:00.000Z', '6h', ref)).toBe(true);
  });

  it('returns false for an observation outside the lookback window', () => {
    // 7 hours ago is outside a 6h lookback
    expect(isWithinLookback('2026-02-20T05:00:00.000Z', '6h', ref)).toBe(false);
  });

  it('returns false for an observation 25 hours ago with 24h lookback', () => {
    expect(isWithinLookback('2026-02-19T11:00:00.000Z', '24h', ref)).toBe(false);
  });

  it('returns true for an observation 1 day ago with 7d lookback', () => {
    expect(isWithinLookback('2026-02-19T12:00:00.000Z', '7d', ref)).toBe(true);
  });

  it('accepts Date objects as observedAt', () => {
    const observed = new Date('2026-02-20T10:00:00.000Z');
    expect(isWithinLookback(observed, '6h', ref)).toBe(true);
  });
});

describe('toFhirDateTime', () => {
  it('returns an ISO 8601 formatted string', () => {
    const date = new Date('2026-02-20T12:00:00.000Z');
    const result = toFhirDateTime(date);
    // formatISO produces ISO 8601 with timezone offset
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('preserves the date information', () => {
    const date = new Date('2026-06-15T08:30:00.000Z');
    const result = toFhirDateTime(date);
    expect(result).toContain('2026-06-15');
  });
});
