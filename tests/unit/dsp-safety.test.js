import { describe, expect, test } from 'vitest';
import { clamp, dbToGain, gainToDb, sanitizeSample, safeGain } from '../../src/dsp/safety.js';

describe('DSP safety', () => {
  test('sanitizeSample replaces non-finite and denormal values safely', () => {
    expect(sanitizeSample(Number.NaN)).toBe(0);
    expect(sanitizeSample(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sanitizeSample(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(sanitizeSample(1e-40)).toBe(0);
    expect(sanitizeSample(-1e-40)).toBe(0);
    expect(sanitizeSample(0.25)).toBe(0.25);
  });

  test('clamp and safeGain contain unsafe extremes', () => {
    expect(clamp(5, -1, 1)).toBe(1);
    expect(clamp(-5, -1, 1)).toBe(-1);
    expect(safeGain(Number.NaN, 2)).toBe(0);
    expect(safeGain(10, 2)).toBe(2);
    expect(safeGain(-10, 2)).toBe(-2);
  });

  test('dB conversions remain finite and round trip practical values', () => {
    expect(dbToGain(0)).toBeCloseTo(1, 8);
    expect(dbToGain(-6)).toBeCloseTo(0.501187, 5);
    expect(gainToDb(1)).toBeCloseTo(0, 8);
    expect(gainToDb(dbToGain(-24))).toBeCloseTo(-24, 6);
    expect(Number.isFinite(gainToDb(0))).toBe(true);
  });

  test('extreme modulation input can be sanitized and bounded', () => {
    const raw = sanitizeSample(1e308);
    expect(Number.isFinite(raw)).toBe(true);
    expect(safeGain(raw, 4)).toBeLessThanOrEqual(4);
  });
});
