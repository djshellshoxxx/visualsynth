import { describe, expect, test } from 'vitest';
import { AdditiveOscillator, SupersawOscillator, WavetableOscillator } from '../../src/dsp/advanced-oscillators.js';
import { ChorusEffect, CompressorEffect, ParametricEqEffect, PhaserEffect, ReverbEffect } from '../../src/dsp/beta-effects.js';

function finiteBlock(processor, count = 1024, input = () => 0.2) {
  return Array.from({ length: count }, (_, index) => processor.processSample(input(index)));
}

describe('advanced oscillator DSP', () => {
  test.each([
    new AdditiveOscillator({ sampleRate: 48000, frequency: 220, harmonics: [1, .5, .25] }),
    new WavetableOscillator({ sampleRate: 48000, frequency: 220, morph: .4 }),
    new SupersawOscillator({ sampleRate: 48000, frequency: 220, voices: 7, detune: .2 })
  ])('produces bounded finite samples', oscillator => {
    const block = Array.from({ length: 2048 }, () => oscillator.nextSample());
    expect(block.every(Number.isFinite)).toBe(true);
    expect(Math.max(...block.map(Math.abs))).toBeLessThanOrEqual(1.25);
    expect(block.some(sample => Math.abs(sample) > 1e-4)).toBe(true);
  });
});

describe('beta effect DSP', () => {
  test.each([
    new ChorusEffect({ sampleRate: 48000 }),
    new PhaserEffect({ sampleRate: 48000 }),
    new ReverbEffect({ sampleRate: 48000 }),
    new ParametricEqEffect({ sampleRate: 48000 }),
    new CompressorEffect({ sampleRate: 48000 })
  ])('stays finite across a signal block', effect => {
    const block = finiteBlock(effect, 4096, index => index === 0 ? 1 : 0.1 * Math.sin(index * .03));
    expect(block.every(Number.isFinite)).toBe(true);
    expect(Math.max(...block.map(Math.abs))).toBeLessThan(4);
  });
});
