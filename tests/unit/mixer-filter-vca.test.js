import { describe, expect, test } from 'vitest';
import { mixSample, equalPowerPan } from '../../src/dsp/mixer.js';
import { StateVariableFilter } from '../../src/dsp/filters.js';
import { applyVca } from '../../src/dsp/vca.js';

describe('mixer', () => {
  test('sums levels, applies polarity and equal-power pan', () => {
    const gains = equalPowerPan(0);
    expect(gains.left).toBeCloseTo(Math.SQRT1_2, 6);
    expect(gains.right).toBeCloseTo(Math.SQRT1_2, 6);
    const mixed = mixSample([
      { sample: 1, level: 0.5, pan: -1, polarity: 1 },
      { sample: 1, level: 0.5, pan: 1, polarity: -1 }
    ]);
    expect(mixed.left).toBeCloseTo(0.5, 6);
    expect(mixed.right).toBeCloseTo(-0.5, 6);
  });
});

describe('filter', () => {
  test('low-pass responds more strongly to DC than a rapidly alternating signal', () => {
    const dc = new StateVariableFilter({ sampleRate: 48000, cutoff: 500, resonance: 0.1, mode: 'lowpass' });
    let dcOut = 0;
    for (let i = 0; i < 2048; i += 1) dcOut = dc.processSample(1);

    const hf = new StateVariableFilter({ sampleRate: 48000, cutoff: 500, resonance: 0.1, mode: 'lowpass' });
    let sum = 0;
    for (let i = 0; i < 2048; i += 1) sum += Math.abs(hf.processSample(i % 2 ? 1 : -1));
    expect(Math.abs(dcOut)).toBeGreaterThan(sum / 2048);
  });

  test('extreme cutoff and resonance remain finite', () => {
    const filter = new StateVariableFilter({ sampleRate: 48000, cutoff: 999999, resonance: 999, mode: 'bandpass' });
    for (let i = 0; i < 1024; i += 1) {
      const value = filter.processSample(Math.sin(i));
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe('VCA', () => {
  test('applies bounded control modulation', () => {
    expect(applyVca(0.5, 0.5)).toBeCloseTo(0.25, 8);
    expect(Number.isFinite(applyVca(1, Number.POSITIVE_INFINITY))).toBe(true);
    expect(Math.abs(applyVca(10, 10, { maxGain: 2 }))).toBeLessThanOrEqual(20);
  });
});
