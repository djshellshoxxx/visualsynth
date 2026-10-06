import { describe, expect, test } from 'vitest';
import { Oscillator, naiveSawSample, polyBlep } from '../../src/dsp/oscillator.js';

describe('Oscillator', () => {
  test('maintains phase continuity and accurate sine pitch', () => {
    const osc = new Oscillator({ sampleRate: 48000, waveform: 'sine', frequency: 1000, phase: 0 });
    const block = osc.renderBlock(480);
    expect(block).toHaveLength(480);
    expect([...block].every(Number.isFinite)).toBe(true);
    expect(osc.phase).toBeCloseTo(0, 8);
    expect(block[12]).toBeCloseTo(1, 2);
  });

  test('pulse width changes duty cycle while remaining bounded', () => {
    const osc = new Oscillator({ sampleRate: 1000, waveform: 'pulse', frequency: 10, pulseWidth: 0.25 });
    const block = osc.renderBlock(100);
    expect(Math.max(...block)).toBeLessThanOrEqual(1.1);
    expect(Math.min(...block)).toBeGreaterThanOrEqual(-1.1);
    const positive = [...block].filter((v) => v > 0).length;
    expect(positive).toBeGreaterThan(10);
    expect(positive).toBeLessThan(40);
  });

  test('discontinuous waveforms use a nonzero PolyBLEP correction near edges', () => {
    expect(polyBlep(0.001, 0.01)).not.toBe(0);
    expect(polyBlep(0.5, 0.01)).toBe(0);
    const osc = new Oscillator({ sampleRate: 48000, waveform: 'saw', frequency: 12000, phase: 0.99 });
    const naive = naiveSawSample(0.99);
    const corrected = osc.nextSample();
    expect(corrected).not.toBeCloseTo(naive, 6);
    expect(Number.isFinite(corrected)).toBe(true);
  });

  test('supports a sub oscillator one octave below the requested frequency', () => {
    const osc = new Oscillator({ sampleRate: 48000, waveform: 'sub', frequency: 440, phase: 0 });
    const block = osc.renderBlock(4800);
    let crossings = 0;
    for (let i = 1; i < block.length; i += 1) if (block[i - 1] <= 0 && block[i] > 0) crossings += 1;
    expect(crossings).toBeGreaterThanOrEqual(20);
    expect(crossings).toBeLessThanOrEqual(24);
  });

  test('supports reverse saw and frequency clamping below Nyquist', () => {
    const osc = new Oscillator({ sampleRate: 48000, waveform: 'reverse-saw', frequency: 999999 });
    const block = osc.renderBlock(32);
    expect([...block].every(Number.isFinite)).toBe(true);
    expect(osc.frequency).toBeLessThan(24000);
  });
});
